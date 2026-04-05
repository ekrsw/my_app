-- Step 1: Add reduces_capacity column to duty_assignments with default true
ALTER TABLE "duty_assignments" ADD COLUMN "reduces_capacity" BOOLEAN NOT NULL DEFAULT true;

-- Step 2: Copy existing values from duty_types to duty_assignments
UPDATE "duty_assignments"
SET "reduces_capacity" = "duty_types"."reduces_capacity"
FROM "duty_types"
WHERE "duty_assignments"."duty_type_id" = "duty_types"."id";

-- Step 3: Rename reduces_capacity to default_reduces_capacity in duty_types
ALTER TABLE "duty_types" RENAME COLUMN "reduces_capacity" TO "default_reduces_capacity";
