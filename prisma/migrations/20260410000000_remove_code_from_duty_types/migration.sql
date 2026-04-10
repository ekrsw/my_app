-- DropIndex
DROP INDEX IF EXISTS "duty_types_code_key";

-- AlterTable
ALTER TABLE "duty_types" DROP COLUMN "code";
