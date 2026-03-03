-- CreateTable
CREATE TABLE "shift_codes" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "default_start_time" TIME(6),
    "default_end_time" TIME(6),
    "default_is_holiday" BOOLEAN NOT NULL DEFAULT false,
    "default_is_paid_leave" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shift_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_codes_code_key" ON "shift_codes"("code");

-- Seed data from existing SHIFT_CODE_MAP
INSERT INTO "shift_codes" ("code", "default_is_holiday", "default_is_paid_leave", "is_active", "sort_order") VALUES
  ('A', false, false, true, 0),
  ('B', false, false, true, 1),
  ('C', false, false, true, 2),
  ('N', false, false, true, 3),
  ('H', true, false, true, 4),
  ('Y', false, true, true, 5),
  ('T', false, false, true, 6),
  ('R', true, false, true, 7),
  ('S', true, false, true, 8);
