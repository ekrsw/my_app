-- employee_function_role_history テーブル作成
CREATE TABLE "employee_function_role_history" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "function_role_id" INTEGER,
    "role_type" VARCHAR(20),
    "is_primary" BOOLEAN,
    "start_date" DATE,
    "end_date" DATE,
    "change_type" VARCHAR(10) NOT NULL,
    "version" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_function_role_history_pkey" PRIMARY KEY ("id")
);

-- インデックス
CREATE UNIQUE INDEX "employee_function_role_history_employee_id_version_key"
  ON "employee_function_role_history"("employee_id", "version");
CREATE INDEX "employee_function_role_history_employee_id_changed_at_idx"
  ON "employee_function_role_history"("employee_id", "changed_at");

-- FK
ALTER TABLE "employee_function_role_history"
  ADD CONSTRAINT "employee_function_role_history_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- トリガー関数（AFTER INSERT/UPDATE/DELETE）
CREATE OR REPLACE FUNCTION record_employee_role_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
  target_employee_id integer;
BEGIN
  target_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM employee_function_role_history
  WHERE employee_id = target_employee_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO employee_function_role_history (
      employee_id, function_role_id, role_type, is_primary,
      start_date, end_date, change_type, version
    ) VALUES (
      NEW.employee_id, NEW.function_role_id, NEW.role_type, NEW.is_primary,
      NEW.start_date, NEW.end_date, 'INSERT', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO employee_function_role_history (
      employee_id, function_role_id, role_type, is_primary,
      start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.function_role_id, OLD.role_type, OLD.is_primary,
      OLD.start_date, OLD.end_date, 'UPDATE', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO employee_function_role_history (
      employee_id, function_role_id, role_type, is_primary,
      start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.function_role_id, OLD.role_type, OLD.is_primary,
      OLD.start_date, OLD.end_date, 'DELETE', next_version
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employee_role_change
AFTER INSERT OR UPDATE OR DELETE ON employee_function_roles
FOR EACH ROW
EXECUTE FUNCTION record_employee_role_change();
