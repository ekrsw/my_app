-- CreateTable
CREATE TABLE "duty_types" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(20),
    "is_active" BOOLEAN DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "duty_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_assignments" (
    "id" SERIAL NOT NULL,
    "employee_id" UUID NOT NULL,
    "duty_type_id" INTEGER NOT NULL,
    "duty_date" DATE NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,

    CONSTRAINT "duty_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_assignment_history" (
    "id" SERIAL NOT NULL,
    "employee_id" UUID NOT NULL,
    "duty_type_id" INTEGER,
    "duty_date" DATE,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "change_type" VARCHAR(10) NOT NULL,
    "version" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duty_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "duty_types_code_key" ON "duty_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "duty_assignments_employee_id_duty_type_id_duty_date_start_t_key" ON "duty_assignments"("employee_id", "duty_type_id", "duty_date", "start_time");

-- CreateIndex
CREATE INDEX "duty_assignment_history_employee_id_changed_at_idx" ON "duty_assignment_history"("employee_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "duty_assignment_history_employee_id_version_key" ON "duty_assignment_history"("employee_id", "version");

-- AddForeignKey
ALTER TABLE "duty_assignments" ADD CONSTRAINT "duty_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_assignments" ADD CONSTRAINT "duty_assignments_duty_type_id_fkey" FOREIGN KEY ("duty_type_id") REFERENCES "duty_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_assignment_history" ADD CONSTRAINT "duty_assignment_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_assignment_history" ADD CONSTRAINT "duty_assignment_history_duty_type_id_fkey" FOREIGN KEY ("duty_type_id") REFERENCES "duty_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigger: record duty assignment changes
CREATE OR REPLACE FUNCTION record_duty_assignment_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
  target_employee_id uuid;
BEGIN
  target_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM duty_assignment_history
  WHERE employee_id = target_employee_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO duty_assignment_history (
      employee_id, duty_type_id, duty_date, start_time, end_time, change_type, version
    ) VALUES (
      NEW.employee_id, NEW.duty_type_id, NEW.duty_date, NEW.start_time, NEW.end_time, 'INSERT', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO duty_assignment_history (
      employee_id, duty_type_id, duty_date, start_time, end_time, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.duty_type_id, OLD.duty_date, OLD.start_time, OLD.end_time, 'UPDATE', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO duty_assignment_history (
      employee_id, duty_type_id, duty_date, start_time, end_time, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.duty_type_id, OLD.duty_date, OLD.start_time, OLD.end_time, 'DELETE', next_version
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_duty_assignment_change
AFTER INSERT OR UPDATE OR DELETE ON duty_assignments
FOR EACH ROW
EXECUTE FUNCTION record_duty_assignment_change();
