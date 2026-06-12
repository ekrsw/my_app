-- Revert app-level-encryption title widening: TEXT -> VARCHAR(100)
ALTER TABLE "duty_assignments" ALTER COLUMN "title" SET DATA TYPE VARCHAR(100);
ALTER TABLE "duty_types" ALTER COLUMN "default_title" SET DATA TYPE VARCHAR(100);
