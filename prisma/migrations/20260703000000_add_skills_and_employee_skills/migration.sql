-- CreateTable
CREATE TABLE "skills" (
    "id" SERIAL NOT NULL,
    "skill_code" VARCHAR(20) NOT NULL,
    "skill_name" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_skills" (
    "id" SERIAL NOT NULL,
    "employee_id" UUID NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_skill_code_key" ON "skills"("skill_code");

-- CreateIndex
CREATE INDEX "employee_skills_employee_skill_date_idx" ON "employee_skills"("employee_id", "skill_id", "start_date");

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateView: 各 (社員, スキル) の最新1行（現在のレベル）だけを返す。
-- DISTINCT ON + ORDER BY start_date DESC, id DESC で「最新の付与＝現レベル」を実現。
-- 同一 start_date のタイブレーカーは id DESC（autoincrement で挿入順と単調に一致）。
CREATE VIEW "employee_current_skills" AS
SELECT DISTINCT ON ("employee_id", "skill_id")
    "id",
    "employee_id",
    "skill_id",
    "level",
    "start_date",
    "created_at"
FROM "employee_skills"
ORDER BY "employee_id", "skill_id", "start_date" DESC, "id" DESC;
