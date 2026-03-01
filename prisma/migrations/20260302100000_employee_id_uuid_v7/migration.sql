-- UUID v7 生成関数（外部拡張不要、gen_random_uuid() ベース）
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid AS $$
DECLARE
  unix_ts_ms bigint;
  uuid_bytes bytea;
BEGIN
  unix_ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  uuid_bytes := substring(int8send(unix_ts_ms) from 3);  -- 6 bytes timestamp
  uuid_bytes := uuid_bytes || gen_random_uuid()::text::bytea;

  -- gen_random_uuid() で 16 バイト生成し、タイムスタンプ部分を上書き
  uuid_bytes := substring(int8send(unix_ts_ms) from 3)  -- 6 bytes: timestamp
             || substring(uuid_send(gen_random_uuid()) from 7);  -- 10 bytes: random

  -- version 7 (bits 48-51 = 0111)
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
  -- variant 10xx (bits 64-65)
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);

  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ========================================
-- 既存データを全削除（型変更のため）
-- ========================================
TRUNCATE TABLE shift_change_history CASCADE;
TRUNCATE TABLE employee_group_history CASCADE;
TRUNCATE TABLE employee_function_role_history CASCADE;
TRUNCATE TABLE employee_position_history CASCADE;
TRUNCATE TABLE employee_external_accounts CASCADE;
TRUNCATE TABLE employee_function_roles CASCADE;
TRUNCATE TABLE employee_positions CASCADE;
TRUNCATE TABLE employee_groups CASCADE;
TRUNCATE TABLE shifts CASCADE;
TRUNCATE TABLE employees CASCADE;

-- ========================================
-- FK 制約・EXCLUDE 制約を全て DROP
-- ========================================
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_employee_id_fkey";
ALTER TABLE "employee_function_roles" DROP CONSTRAINT "employee_function_roles_employee_id_fkey";
ALTER TABLE "shift_change_history" DROP CONSTRAINT "shift_change_history_employee_id_fkey";
ALTER TABLE "employee_group_history" DROP CONSTRAINT "employee_group_history_employee_id_fkey";
ALTER TABLE "employee_external_accounts" DROP CONSTRAINT "employee_external_accounts_employee_id_fkey";
ALTER TABLE "employee_function_role_history" DROP CONSTRAINT "employee_function_role_history_employee_id_fkey";
ALTER TABLE "employee_positions" DROP CONSTRAINT "employee_positions_employee_id_fkey";
ALTER TABLE "employee_groups" DROP CONSTRAINT "employee_groups_employee_id_fkey";
ALTER TABLE "employee_position_history" DROP CONSTRAINT "employee_position_history_employee_id_fkey";

-- EXCLUDE 制約を DROP（employee_id の型変更前に必要）
ALTER TABLE "employee_positions" DROP CONSTRAINT IF EXISTS "employee_positions_no_overlap";

-- ========================================
-- employees.id を INTEGER → UUID に変更
-- ========================================
ALTER TABLE "employees" DROP CONSTRAINT "employees_pkey";
ALTER TABLE "employees" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "employees" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::text::uuid;
ALTER TABLE "employees" ALTER COLUMN "id" SET DEFAULT uuid_generate_v7();
ALTER TABLE "employees" ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");

-- SERIAL 用のシーケンスを削除
DROP SEQUENCE IF EXISTS employees_id_seq;

-- ========================================
-- 全9テーブルの employee_id を INTEGER → UUID に変更
-- ========================================
ALTER TABLE "shifts" ALTER COLUMN "employee_id" SET DATA TYPE uuid USING "employee_id"::text::uuid;
ALTER TABLE "employee_function_roles" ALTER COLUMN "employee_id" SET DATA TYPE uuid USING "employee_id"::text::uuid;
ALTER TABLE "shift_change_history" ALTER COLUMN "employee_id" SET DATA TYPE uuid USING "employee_id"::text::uuid;
ALTER TABLE "employee_group_history" ALTER COLUMN "employee_id" SET DATA TYPE uuid USING "employee_id"::text::uuid;
ALTER TABLE "employee_external_accounts" ALTER COLUMN "employee_id" SET DATA TYPE uuid USING "employee_id"::text::uuid;
ALTER TABLE "employee_function_role_history" ALTER COLUMN "employee_id" SET DATA TYPE uuid USING "employee_id"::text::uuid;
ALTER TABLE "employee_positions" ALTER COLUMN "employee_id" SET DATA TYPE uuid USING "employee_id"::text::uuid;
ALTER TABLE "employee_groups" ALTER COLUMN "employee_id" SET DATA TYPE uuid USING "employee_id"::text::uuid;
ALTER TABLE "employee_position_history" ALTER COLUMN "employee_id" SET DATA TYPE uuid USING "employee_id"::text::uuid;

-- ========================================
-- FK 制約を再作成（ON DELETE CASCADE 維持）
-- ========================================
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_function_roles" ADD CONSTRAINT "employee_function_roles_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shift_change_history" ADD CONSTRAINT "shift_change_history_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_group_history" ADD CONSTRAINT "employee_group_history_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_external_accounts" ADD CONSTRAINT "employee_external_accounts_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_function_role_history" ADD CONSTRAINT "employee_function_role_history_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_groups" ADD CONSTRAINT "employee_groups_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_position_history" ADD CONSTRAINT "employee_position_history_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EXCLUDE 制約を再作成（employee_id が uuid 型に変更済み）
ALTER TABLE "employee_positions"
  ADD CONSTRAINT "employee_positions_no_overlap"
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(start_date, COALESCE(end_date, '9999-12-31'::date), '[)') WITH &&
  );

-- ========================================
-- トリガー関数を更新（target_employee_id を uuid 型に）
-- ========================================

-- 1. record_employee_role_change()
CREATE OR REPLACE FUNCTION record_employee_role_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
  target_employee_id uuid;
BEGIN
  target_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM employee_function_role_history
  WHERE employee_id = target_employee_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO employee_function_role_history (
      employee_id, function_role_id, role_type, is_primary,
      start_date, end_date, change_type, version
    ) VALUES (
      NEW.employee_id, NEW.function_role_id, NEW.role_type, NEW.is_primary,
      NEW.start_date, NEW.end_date, 'INSERT', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO employee_function_role_history (
      employee_id, function_role_id, role_type, is_primary,
      start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.function_role_id, OLD.role_type, OLD.is_primary,
      OLD.start_date, OLD.end_date, 'UPDATE', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO employee_function_role_history (
      employee_id, function_role_id, role_type, is_primary,
      start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.function_role_id, OLD.role_type, OLD.is_primary,
      OLD.start_date, OLD.end_date, 'DELETE', next_version
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. record_employee_position_change()
CREATE OR REPLACE FUNCTION record_employee_position_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
  target_employee_id uuid;
BEGIN
  target_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM employee_position_history
  WHERE employee_id = target_employee_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO employee_position_history (
      employee_id, position_id, start_date, end_date, change_type, version
    ) VALUES (
      NEW.employee_id, NEW.position_id, NEW.start_date, NEW.end_date, 'INSERT', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO employee_position_history (
      employee_id, position_id, start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.position_id, OLD.start_date, OLD.end_date, 'UPDATE', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO employee_position_history (
      employee_id, position_id, start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.position_id, OLD.start_date, OLD.end_date, 'DELETE', next_version
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. record_employee_group_change()
CREATE OR REPLACE FUNCTION record_employee_group_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
  target_employee_id uuid;
BEGIN
  target_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM employee_group_history
  WHERE employee_id = target_employee_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO employee_group_history (
      employee_id, group_id, start_date, end_date, change_type, version
    ) VALUES (
      NEW.employee_id, NEW.group_id, NEW.start_date, NEW.end_date, 'INSERT', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO employee_group_history (
      employee_id, group_id, start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.group_id, OLD.start_date, OLD.end_date, 'UPDATE', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO employee_group_history (
      employee_id, group_id, start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.group_id, OLD.start_date, OLD.end_date, 'DELETE', next_version
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;
