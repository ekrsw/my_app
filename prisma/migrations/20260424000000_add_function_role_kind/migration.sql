-- =============================================================================
-- Add function_role_kind enum and kind columns for semantic role classification
--
-- Problem: role_type was a free-form string used for BOTH display labels and
-- semantic classification (supervisor vs business). Across environments the
-- role_type values diverged (e.g., "権限"/"職務" in one env vs "監督"/"業務" in
-- another), silently breaking filter/aggregate logic that compared against
-- hardcoded strings.
--
-- Solution: separate concerns.
--   - role_type remains as a free-form display label (unchanged)
--   - new kind enum provides the semantic category used by all logic
-- =============================================================================

-- 1. Create enum type
CREATE TYPE "function_role_kind" AS ENUM ('SUPERVISOR', 'BUSINESS', 'OTHER');

-- 2. Add kind columns (NOT NULL DEFAULT 'OTHER' so existing rows are safe)
ALTER TABLE "function_roles"
  ADD COLUMN "kind" "function_role_kind" NOT NULL DEFAULT 'OTHER';

ALTER TABLE "employee_function_roles"
  ADD COLUMN "kind" "function_role_kind" NOT NULL DEFAULT 'OTHER';

ALTER TABLE "employee_function_role_history"
  ADD COLUMN "kind" "function_role_kind";

-- 3. Back-fill: map known role_type values to kinds
--    Unknown role_type values remain 'OTHER' and must be reassigned via admin UI.
UPDATE "function_roles"
  SET "kind" = 'SUPERVISOR'
  WHERE "role_type" IN ('監督', '権限', 'SV');

UPDATE "function_roles"
  SET "kind" = 'BUSINESS'
  WHERE "role_type" IN ('業務', '職務');

-- 4. Propagate kind to junction and history tables from the master
UPDATE "employee_function_roles" efr
  SET "kind" = fr."kind"
  FROM "function_roles" fr
  WHERE efr."function_role_id" = fr."id";

UPDATE "employee_function_role_history" h
  SET "kind" = fr."kind"
  FROM "function_roles" fr
  WHERE h."function_role_id" = fr."id";

-- 5. Update trigger: set_efr_role_type now also copies kind
CREATE OR REPLACE FUNCTION set_efr_role_type()
RETURNS TRIGGER AS $$
BEGIN
  SELECT role_type, kind INTO NEW.role_type, NEW.kind
  FROM function_roles
  WHERE id = NEW.function_role_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Update trigger: record_employee_role_change now includes kind in history
CREATE OR REPLACE FUNCTION record_employee_role_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
  target_employee_id uuid;
BEGIN
  target_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM employee_function_role_history
  WHERE employee_id = target_employee_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO employee_function_role_history (
      employee_id, function_role_id, role_type, kind, is_primary,
      start_date, end_date, change_type, version
    ) VALUES (
      NEW.employee_id, NEW.function_role_id, NEW.role_type, NEW.kind, NEW.is_primary,
      NEW.start_date, NEW.end_date, 'INSERT', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO employee_function_role_history (
      employee_id, function_role_id, role_type, kind, is_primary,
      start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.function_role_id, OLD.role_type, OLD.kind, OLD.is_primary,
      OLD.start_date, OLD.end_date, 'UPDATE', next_version
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO employee_function_role_history (
      employee_id, function_role_id, role_type, kind, is_primary,
      start_date, end_date, change_type, version
    ) VALUES (
      OLD.employee_id, OLD.function_role_id, OLD.role_type, OLD.kind, OLD.is_primary,
      OLD.start_date, OLD.end_date, 'DELETE', next_version
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. New unique index on (employee_id, kind) for SUPERVISOR/BUSINESS exclusivity
--    Complements the existing (employee_id, role_type) index; both coexist.
CREATE UNIQUE INDEX "idx_efr_unique_active_kind"
ON "employee_function_roles" ("employee_id", "kind")
WHERE "end_date" IS NULL AND "kind" IN ('SUPERVISOR', 'BUSINESS');
