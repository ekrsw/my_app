-- btree_gist 拡張（除外制約に必要）
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- positions テーブル
CREATE TABLE "positions" (
    "id" SERIAL NOT NULL,
    "position_code" VARCHAR(20) NOT NULL,
    "position_name" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "positions_position_code_key" ON "positions"("position_code");

-- employee_positions テーブル
CREATE TABLE "employee_positions" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "position_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    CONSTRAINT "employee_positions_pkey" PRIMARY KEY ("id")
);

-- FK
ALTER TABLE "employee_positions"
  ADD CONSTRAINT "employee_positions_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_positions"
  ADD CONSTRAINT "employee_positions_position_id_fkey"
  FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 除外制約: 同一従業員の役職期間重複を防止
ALTER TABLE "employee_positions"
  ADD CONSTRAINT "employee_positions_no_overlap"
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(start_date, COALESCE(end_date, '9999-12-31'::date), '[)') WITH &&
  );

-- employee_position_history テーブル
CREATE TABLE "employee_position_history" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "position_id" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "change_type" VARCHAR(10) NOT NULL,
    "version" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_position_history_pkey" PRIMARY KEY ("id")
);

-- インデックス
CREATE UNIQUE INDEX "employee_position_history_employee_id_version_key"
  ON "employee_position_history"("employee_id", "version");
CREATE INDEX "employee_position_history_employee_id_changed_at_idx"
  ON "employee_position_history"("employee_id", "changed_at");

-- FK
ALTER TABLE "employee_position_history"
  ADD CONSTRAINT "employee_position_history_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- トリガー関数（AFTER INSERT/UPDATE/DELETE on employee_positions）
CREATE OR REPLACE FUNCTION record_employee_position_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
  target_employee_id integer;
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

CREATE TRIGGER trg_employee_position_change
AFTER INSERT OR UPDATE OR DELETE ON employee_positions
FOR EACH ROW
EXECUTE FUNCTION record_employee_position_change();

-- データ移行: function_roles WHERE role_type='POSITION' → positions
INSERT INTO positions (position_code, position_name, is_active, sort_order)
SELECT role_code, role_name, COALESCE(is_active, true), id
FROM function_roles
WHERE role_type = 'POSITION';

-- データ移行: employee_function_roles の POSITION レコード → employee_positions
INSERT INTO employee_positions (employee_id, position_id, start_date, end_date)
SELECT
  efr.employee_id,
  p.id,
  COALESCE(efr.start_date, CURRENT_DATE),
  efr.end_date
FROM employee_function_roles efr
JOIN function_roles fr ON fr.id = efr.function_role_id
JOIN positions p ON p.position_code = fr.role_code
WHERE fr.role_type = 'POSITION'
AND efr.employee_id IS NOT NULL;

-- 移行後、元の POSITION データを DELETE
DELETE FROM employee_function_roles
WHERE function_role_id IN (SELECT id FROM function_roles WHERE role_type = 'POSITION');

DELETE FROM function_roles WHERE role_type = 'POSITION';
