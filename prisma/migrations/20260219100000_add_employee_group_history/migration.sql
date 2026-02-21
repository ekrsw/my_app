-- CreateTable
CREATE TABLE "employee_group_history" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "group_id" INTEGER,
    "assignment_date" DATE,
    "change_type" VARCHAR(10) NOT NULL,
    "version" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_group_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_group_history_employee_id_changed_at_idx" ON "employee_group_history"("employee_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "employee_group_history_employee_id_version_key" ON "employee_group_history"("employee_id", "version");

-- AddForeignKey
ALTER TABLE "employee_group_history" ADD CONSTRAINT "employee_group_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_group_history" ADD CONSTRAINT "employee_group_history_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTriggerFunction
CREATE OR REPLACE FUNCTION record_employee_group_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
BEGIN
  IF OLD.group_id IS DISTINCT FROM NEW.group_id THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
    FROM employee_group_history
    WHERE employee_id = OLD.id;

    INSERT INTO employee_group_history (
      employee_id, group_id, assignment_date, change_type, version, changed_at
    ) VALUES (
      OLD.id, OLD.group_id, OLD.assignment_date, 'UPDATE', next_version, CURRENT_TIMESTAMP
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateTrigger
CREATE TRIGGER trg_employee_group_change
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION record_employee_group_change();
