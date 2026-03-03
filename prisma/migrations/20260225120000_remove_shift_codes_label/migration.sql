-- Remove label column from shift_codes (IF EXISTS for idempotency)
ALTER TABLE "shift_codes" DROP COLUMN IF EXISTS "label";
