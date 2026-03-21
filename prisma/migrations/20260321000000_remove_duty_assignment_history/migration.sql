-- Drop trigger first
DROP TRIGGER IF EXISTS trg_duty_assignment_change ON duty_assignments;

-- Drop trigger function
DROP FUNCTION IF EXISTS record_duty_assignment_change();

-- Drop history table
DROP TABLE IF EXISTS duty_assignment_history;
