-- CreateTriggerFunction
CREATE OR REPLACE FUNCTION record_employee_name_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name OR OLD.name_kana IS DISTINCT FROM NEW.name_kana THEN
    -- Close the current record
    UPDATE employee_name_history
    SET valid_to = CURRENT_DATE, is_current = false
    WHERE employee_id = OLD.id AND is_current = true;

    -- If no current record existed, archive the old name first
    IF NOT FOUND THEN
      INSERT INTO employee_name_history (employee_id, name, name_kana, valid_from, valid_to, is_current)
      VALUES (OLD.id, OLD.name, OLD.name_kana, CURRENT_DATE, CURRENT_DATE, false);
    END IF;

    -- Insert the new name as the current record
    INSERT INTO employee_name_history (employee_id, name, name_kana, valid_from, is_current)
    VALUES (OLD.id, NEW.name, NEW.name_kana, CURRENT_DATE, true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateTrigger
CREATE TRIGGER trg_employee_name_change
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION record_employee_name_change();
