-- AlterTable
ALTER TABLE "shift_codes" ADD COLUMN "color" VARCHAR(20);

-- Seed existing shift codes with their current hardcoded colors
UPDATE "shift_codes" SET "color" = 'blue' WHERE "code" = 'A';
UPDATE "shift_codes" SET "color" = 'indigo' WHERE "code" = 'B';
UPDATE "shift_codes" SET "color" = 'purple' WHERE "code" = 'C';
UPDATE "shift_codes" SET "color" = 'gray' WHERE "code" = 'N';
UPDATE "shift_codes" SET "color" = 'red' WHERE "code" = 'H';
UPDATE "shift_codes" SET "color" = 'green' WHERE "code" = 'Y';
UPDATE "shift_codes" SET "color" = 'sky' WHERE "code" = 'T';
UPDATE "shift_codes" SET "color" = 'orange' WHERE "code" = 'R';
UPDATE "shift_codes" SET "color" = 'yellow' WHERE "code" = 'S';
