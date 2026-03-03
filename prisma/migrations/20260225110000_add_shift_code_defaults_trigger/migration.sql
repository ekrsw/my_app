-- Function: apply_shift_code_defaults
-- When shift_code is set or changed on a shift, look up the shift_codes table
-- and fill in start_time/end_time/is_holiday/is_paid_leave from defaults
-- if they are NULL (i.e. not explicitly provided by the caller).
CREATE OR REPLACE FUNCTION apply_shift_code_defaults()
RETURNS TRIGGER AS $$
DECLARE
  sc RECORD;
BEGIN
  -- Only apply when shift_code is set and has changed (or on INSERT)
  IF NEW.shift_code IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.shift_code IS DISTINCT FROM NEW.shift_code)
  THEN
    SELECT default_start_time, default_end_time, default_is_holiday, default_is_paid_leave
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
      IF NEW.is_paid_leave IS NULL THEN
        NEW.is_paid_leave := sc.default_is_paid_leave;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: trg_shift_apply_defaults
-- Fires BEFORE INSERT OR UPDATE on shifts.
-- Alphabetically before trg_shift_change_history, so defaults are applied
-- before the history trigger records OLD values.
DROP TRIGGER IF EXISTS trg_shift_apply_defaults ON shifts;
CREATE TRIGGER trg_shift_apply_defaults
BEFORE INSERT OR UPDATE ON shifts
FOR EACH ROW
EXECUTE FUNCTION apply_shift_code_defaults();
