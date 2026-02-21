-- =============================================================================
-- Migration: Employee Group Junction Table
-- Moves from employees.group_id direct FK to employee_groups junction table
-- =============================================================================

-- 1. Create employee_groups junction table
CREATE TABLE "employee_groups" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    CONSTRAINT "employee_groups_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "employee_groups"
  ADD CONSTRAINT "employee_groups_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_groups"
  ADD CONSTRAINT "employee_groups_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Migrate existing data: employees.group_id → employee_groups
INSERT INTO employee_groups (employee_id, group_id, start_date)
SELECT id, group_id, COALESCE(hire_date, CURRENT_DATE)
FROM employees WHERE group_id IS NOT NULL;

-- 3. Drop old trigger on employees table
DROP TRIGGER IF EXISTS trg_employee_group_change ON employees;
DROP FUNCTION IF EXISTS record_employee_group_change();

-- 4. Modify employee_group_history: replace hire_date with start_date/end_date
ALTER TABLE "employee_group_history" DROP COLUMN IF EXISTS "hire_date";
ALTER TABLE "employee_group_history" ADD COLUMN IF NOT EXISTS "start_date" DATE;
ALTER TABLE "employee_group_history" ADD COLUMN IF NOT EXISTS "end_date" DATE;

-- 5. Create new trigger on employee_groups (same pattern as employee_positions)
CREATE OR REPLACE FUNCTION record_employee_group_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
  target_employee_id integer;
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

CREATE TRIGGER trg_employee_group_change
AFTER INSERT OR UPDATE OR DELETE ON employee_groups
FOR EACH ROW
EXECUTE FUNCTION record_employee_group_change();

-- 6. Remove group_id from employees table
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_group_id_fkey";
ALTER TABLE "employees" DROP COLUMN "group_id";
