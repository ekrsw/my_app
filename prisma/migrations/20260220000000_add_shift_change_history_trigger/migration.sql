-- CreateTriggerFunction
CREATE OR REPLACE FUNCTION record_shift_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
BEGIN
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
      shift_id, employee_id, shift_date, shift_code,
      start_time, end_time, is_holiday, is_paid_leave, is_remote,
      change_type, version, changed_at
    ) VALUES (
      OLD.id, OLD.employee_id, OLD.shift_date, OLD.shift_code,
      OLD.start_time, OLD.end_time, OLD.is_holiday, OLD.is_paid_leave, OLD.is_remote,
      'UPDATE', next_version, CURRENT_TIMESTAMP
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateTrigger
CREATE TRIGGER trg_shift_change
BEFORE UPDATE ON shifts
FOR EACH ROW
EXECUTE FUNCTION record_shift_change();
