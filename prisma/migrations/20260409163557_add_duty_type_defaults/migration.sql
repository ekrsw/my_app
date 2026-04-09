-- AlterTable
ALTER TABLE "duty_types" ADD COLUMN     "default_end_time" VARCHAR(5),
ADD COLUMN     "default_note" TEXT,
ADD COLUMN     "default_start_time" VARCHAR(5);
