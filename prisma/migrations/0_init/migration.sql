-- =============================================================================
-- Baseline migration: Represents the database state before junction table migration
-- Creates the full schema including tables, indexes, FKs, triggers, and constraints
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- =============================================================================
-- Tables
-- =============================================================================

CREATE TABLE "groups" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_kana" VARCHAR(100),
    "hire_date" DATE,
    "termination_date" DATE,
    "group_id" INTEGER,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shifts" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER,
    "shift_date" DATE NOT NULL,
    "shift_code" VARCHAR(20),
    "start_time" TIME(6),
    "end_time" TIME(6),
    "is_holiday" BOOLEAN DEFAULT false,
    "is_paid_leave" BOOLEAN DEFAULT false,
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "function_roles" (
    "id" SERIAL NOT NULL,
    "role_code" VARCHAR(20) NOT NULL,
    "role_name" VARCHAR(50) NOT NULL,
    "role_type" VARCHAR(20) NOT NULL DEFAULT 'FUNCTION',
    "is_active" BOOLEAN DEFAULT true,
    CONSTRAINT "function_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_function_roles" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER,
    "function_role_id" INTEGER,
    "role_type" VARCHAR(20) NOT NULL DEFAULT 'FUNCTION',
    "is_primary" BOOLEAN DEFAULT false,
    "start_date" DATE,
    "end_date" DATE,
    CONSTRAINT "employee_function_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shift_change_history" (
    "id" SERIAL NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "employee_id" INTEGER,
    "shift_date" DATE NOT NULL,
    "shift_code" VARCHAR(20),
    "start_time" TIME(6),
    "end_time" TIME(6),
    "is_holiday" BOOLEAN,
    "is_paid_leave" BOOLEAN,
    "is_remote" BOOLEAN,
    "change_type" VARCHAR(10) NOT NULL,
    "version" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" VARCHAR(255),
    CONSTRAINT "shift_change_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_group_history" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "group_id" INTEGER,
    "hire_date" DATE,
    "change_type" VARCHAR(10) NOT NULL,
    "version" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_group_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_tools" (
    "id" SERIAL NOT NULL,
    "tool_code" VARCHAR(50) NOT NULL,
    "tool_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    CONSTRAINT "external_tools_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_external_accounts" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER,
    "external_tool_id" INTEGER,
    "external_name" VARCHAR(100) NOT NULL,
    "external_id" VARCHAR(100),
    "is_active" BOOLEAN DEFAULT true,
    CONSTRAINT "employee_external_accounts_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "positions" (
    "id" SERIAL NOT NULL,
    "position_code" VARCHAR(20) NOT NULL,
    "position_name" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_positions" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "position_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    CONSTRAINT "employee_positions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_position_history" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "position_id" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "change_type" VARCHAR(10) NOT NULL,
    "version" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_position_history_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");
CREATE UNIQUE INDEX "shifts_employee_id_shift_date_key" ON "shifts"("employee_id", "shift_date");
CREATE UNIQUE INDEX "function_roles_role_code_key" ON "function_roles"("role_code");

CREATE INDEX "shift_change_history_shift_id_changed_at_idx" ON "shift_change_history"("shift_id", "changed_at");
CREATE INDEX "shift_change_history_employee_id_shift_date_idx" ON "shift_change_history"("employee_id", "shift_date");
CREATE UNIQUE INDEX "shift_change_history_shift_id_version_key" ON "shift_change_history"("shift_id", "version");

CREATE INDEX "employee_group_history_employee_id_changed_at_idx" ON "employee_group_history"("employee_id", "changed_at");
CREATE UNIQUE INDEX "employee_group_history_employee_id_version_key" ON "employee_group_history"("employee_id", "version");

CREATE INDEX "employee_function_role_history_employee_id_changed_at_idx" ON "employee_function_role_history"("employee_id", "changed_at");
CREATE UNIQUE INDEX "employee_function_role_history_employee_id_version_key" ON "employee_function_role_history"("employee_id", "version");

CREATE UNIQUE INDEX "positions_position_code_key" ON "positions"("position_code");

CREATE INDEX "employee_position_history_employee_id_changed_at_idx" ON "employee_position_history"("employee_id", "changed_at");
CREATE UNIQUE INDEX "employee_position_history_employee_id_version_key" ON "employee_position_history"("employee_id", "version");

-- Partial unique indexes on employee_function_roles
CREATE UNIQUE INDEX "idx_efr_unique_active_role"
ON "employee_function_roles" ("employee_id", "function_role_id")
WHERE "end_date" IS NULL;

CREATE UNIQUE INDEX "idx_efr_unique_active_role_type"
ON "employee_function_roles" ("employee_id", "role_type")
WHERE "end_date" IS NULL;

-- =============================================================================
-- Foreign Keys
-- =============================================================================

ALTER TABLE "employees" ADD CONSTRAINT "employees_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_function_roles" ADD CONSTRAINT "employee_function_roles_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_function_roles" ADD CONSTRAINT "employee_function_roles_function_role_id_fkey"
  FOREIGN KEY ("function_role_id") REFERENCES "function_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shift_change_history" ADD CONSTRAINT "shift_change_history_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_group_history" ADD CONSTRAINT "employee_group_history_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_group_history" ADD CONSTRAINT "employee_group_history_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_external_accounts" ADD CONSTRAINT "employee_external_accounts_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_external_accounts" ADD CONSTRAINT "employee_external_accounts_external_tool_id_fkey"
  FOREIGN KEY ("external_tool_id") REFERENCES "external_tools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_function_role_history" ADD CONSTRAINT "employee_function_role_history_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_position_id_fkey"
  FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_position_history" ADD CONSTRAINT "employee_position_history_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- Exclusion Constraints
-- =============================================================================

ALTER TABLE "employee_positions"
  ADD CONSTRAINT "employee_positions_no_overlap"
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(start_date, COALESCE(end_date, '9999-12-31'::date), '[)') WITH &&
  );

-- =============================================================================
-- Trigger Functions & Triggers
-- =============================================================================

-- 1. Auto-set role_type from function_roles
CREATE OR REPLACE FUNCTION set_efr_role_type()
RETURNS TRIGGER AS $$
BEGIN
  SELECT role_type INTO NEW.role_type
  FROM function_roles
  WHERE id = NEW.function_role_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_efr_set_role_type
BEFORE INSERT OR UPDATE OF function_role_id
ON employee_function_roles
FOR EACH ROW
EXECUTE FUNCTION set_efr_role_type();

-- 2. Shift change history
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

CREATE TRIGGER trg_shift_change
BEFORE UPDATE ON shifts
FOR EACH ROW
EXECUTE FUNCTION record_shift_change();

-- 4. Employee group change history (old trigger on employees table)
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
      employee_id, group_id, hire_date, change_type, version, changed_at
    ) VALUES (
      OLD.id, OLD.group_id, OLD.hire_date, 'UPDATE', next_version, CURRENT_TIMESTAMP
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employee_group_change
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION record_employee_group_change();

-- 5. Employee function role change history
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

-- 6. Employee position change history
CREATE OR REPLACE FUNCTION record_employee_position_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
  target_employee_id integer;
BEGIN
  target_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM employee_position_history
  WHERE employee_id = target_employee_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO employee_position_history (
      employee_id, position_id, start_date, end_date, change_type, version
    ) VALUES (
      NEW.employee_id, NEW.position_id, NEW.start_date, NEW.end_date, 'INSERT', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO employee_position_history (
      employee_id, position_id, start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.position_id, OLD.start_date, OLD.end_date, 'UPDATE', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO employee_position_history (
      employee_id, position_id, start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.position_id, OLD.start_date, OLD.end_date, 'DELETE', next_version
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employee_position_change
AFTER INSERT OR UPDATE OR DELETE ON employee_positions
FOR EACH ROW
EXECUTE FUNCTION record_employee_position_change();
