-- 1. NEW値カラムの追加
ALTER TABLE shift_change_history
  ADD COLUMN new_shift_code VARCHAR(20),
  ADD COLUMN new_start_time TIME(6),
  ADD COLUMN new_end_time TIME(6),
  ADD COLUMN new_is_holiday BOOLEAN,
  ADD COLUMN new_is_paid_leave BOOLEAN,
  ADD COLUMN new_is_remote BOOLEAN;

-- 2. shifts へのFK制約を削除
ALTER TABLE shift_change_history
  DROP CONSTRAINT shift_change_history_shift_id_fkey;

-- 3. employees へのFK制約を追加
ALTER TABLE shift_change_history
  ADD CONSTRAINT shift_change_history_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employees(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. トリガー関数を UPDATE/DELETE 両対応に更新（NEW値も記録）
CREATE OR REPLACE FUNCTION record_shift_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
    FROM shift_change_history
    WHERE shift_id = OLD.id;

    INSERT INTO shift_change_history (
      shift_id, employee_id, shift_date,
      shift_code, start_time, end_time, is_holiday, is_paid_leave, is_remote,
      new_shift_code, new_start_time, new_end_time, new_is_holiday, new_is_paid_leave, new_is_remote,
      change_type, version, changed_at
    ) VALUES (
      OLD.id, OLD.employee_id, OLD.shift_date,
      OLD.shift_code, OLD.start_time, OLD.end_time, OLD.is_holiday, OLD.is_paid_leave, OLD.is_remote,
      NULL, NULL, NULL, NULL, NULL, NULL,
      'DELETE', next_version, CURRENT_TIMESTAMP
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.shift_code IS DISTINCT FROM NEW.shift_code
      OR OLD.start_time IS DISTINCT FROM NEW.start_time
      OR OLD.end_time IS DISTINCT FROM NEW.end_time
      OR OLD.is_holiday IS DISTINCT FROM NEW.is_holiday
      OR OLD.is_paid_leave IS DISTINCT FROM NEW.is_paid_leave
      OR OLD.is_remote IS DISTINCT FROM NEW.is_remote
    THEN
      SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
      FROM shift_change_history
      WHERE shift_id = OLD.id;

      INSERT INTO shift_change_history (
        shift_id, employee_id, shift_date,
        shift_code, start_time, end_time, is_holiday, is_paid_leave, is_remote,
        new_shift_code, new_start_time, new_end_time, new_is_holiday, new_is_paid_leave, new_is_remote,
        change_type, version, changed_at
      ) VALUES (
        OLD.id, OLD.employee_id, OLD.shift_date,
        OLD.shift_code, OLD.start_time, OLD.end_time, OLD.is_holiday, OLD.is_paid_leave, OLD.is_remote,
        NEW.shift_code, NEW.start_time, NEW.end_time, NEW.is_holiday, NEW.is_paid_leave, NEW.is_remote,
        'UPDATE', next_version, CURRENT_TIMESTAMP
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. トリガーを UPDATE OR DELETE に変更
DROP TRIGGER IF EXISTS trg_shift_change ON shifts;
DROP TRIGGER IF EXISTS trg_shift_change_history ON shifts;
CREATE TRIGGER trg_shift_change_history
BEFORE UPDATE OR DELETE ON shifts
FOR EACH ROW
EXECUTE FUNCTION record_shift_change();
