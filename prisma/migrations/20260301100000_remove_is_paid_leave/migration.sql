-- is_paid_leave 関連カラムを全テーブルから削除
ALTER TABLE "shifts" DROP COLUMN "is_paid_leave";
ALTER TABLE "shift_change_history" DROP COLUMN "is_paid_leave";
ALTER TABLE "shift_change_history" DROP COLUMN "new_is_paid_leave";
ALTER TABLE "shift_codes" DROP COLUMN "default_is_paid_leave";

-- record_shift_change() トリガー関数を再作成（is_paid_leave 参照を除去）
CREATE OR REPLACE FUNCTION record_shift_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
BEGIN
  -- DELETE の場合: 常に記録（NEW値はすべてNULL）
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
    FROM shift_change_history
    WHERE shift_id = OLD.id;

    INSERT INTO shift_change_history (
      shift_id, employee_id, shift_date,
      shift_code, start_time, end_time, is_holiday, is_remote,
      new_shift_code, new_start_time, new_end_time, new_is_holiday, new_is_remote,
      version, changed_at
    ) VALUES (
      OLD.id, OLD.employee_id, OLD.shift_date,
      OLD.shift_code, OLD.start_time, OLD.end_time, OLD.is_holiday, OLD.is_remote,
      NULL, NULL, NULL, NULL, NULL,
      next_version, CURRENT_TIMESTAMP
    );
    RETURN OLD;
  END IF;

  -- UPDATE の場合: トラッキング対象カラムに変更がある場合のみ記録
  IF TG_OP = 'UPDATE' THEN
    IF OLD.shift_code IS DISTINCT FROM NEW.shift_code
      OR OLD.start_time IS DISTINCT FROM NEW.start_time
      OR OLD.end_time IS DISTINCT FROM NEW.end_time
      OR OLD.is_holiday IS DISTINCT FROM NEW.is_holiday
      OR OLD.is_remote IS DISTINCT FROM NEW.is_remote
    THEN
      SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
      FROM shift_change_history
      WHERE shift_id = OLD.id;

      INSERT INTO shift_change_history (
        shift_id, employee_id, shift_date,
        shift_code, start_time, end_time, is_holiday, is_remote,
        new_shift_code, new_start_time, new_end_time, new_is_holiday, new_is_remote,
        version, changed_at
      ) VALUES (
        OLD.id, OLD.employee_id, OLD.shift_date,
        OLD.shift_code, OLD.start_time, OLD.end_time, OLD.is_holiday, OLD.is_remote,
        NEW.shift_code, NEW.start_time, NEW.end_time, NEW.is_holiday, NEW.is_remote,
        next_version, CURRENT_TIMESTAMP
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- apply_shift_code_defaults() トリガー関数を再作成（default_is_paid_leave 参照を除去）
CREATE OR REPLACE FUNCTION apply_shift_code_defaults()
RETURNS TRIGGER AS $$
DECLARE
  sc RECORD;
BEGIN
  IF NEW.shift_code IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.shift_code IS DISTINCT FROM NEW.shift_code)
  THEN
    SELECT default_start_time, default_end_time, default_is_holiday
    INTO sc
    FROM shift_codes
    WHERE code = NEW.shift_code;

    IF FOUND THEN
      IF NEW.start_time IS NULL AND sc.default_start_time IS NOT NULL THEN
        NEW.start_time := sc.default_start_time;
      END IF;
      IF NEW.end_time IS NULL AND sc.default_end_time IS NOT NULL THEN
        NEW.end_time := sc.default_end_time;
      END IF;
      IF NEW.is_holiday IS NULL THEN
        NEW.is_holiday := sc.default_is_holiday;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
