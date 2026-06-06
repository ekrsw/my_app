-- CSVインポート等の実施記録テーブル（1インポート=1行のサマリ）。
-- 変更履歴(shift_change_history)とは別物で、履歴トリガーは付与しない（追記専用の事実記録）。
CREATE TABLE "import_log" (
    "id" SERIAL NOT NULL,
    "target_type" VARCHAR(30) NOT NULL,
    "file_name" VARCHAR(255),
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "imported_by" VARCHAR(100),
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_log_target_type_imported_at_idx" ON "import_log"("target_type", "imported_at");
