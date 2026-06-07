-- CreateTable
CREATE TABLE "duty_assignment_bulk_replace_batch" (
    "id" SERIAL NOT NULL,
    "from_duty_type_ids" INTEGER[],
    "to_duty_type_id" INTEGER NOT NULL,
    "replaced_count" INTEGER NOT NULL,
    "skipped_count" INTEGER NOT NULL,
    "executed_by" VARCHAR(100),
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reverted_by" VARCHAR(100),
    "reverted_at" TIMESTAMP(3),

    CONSTRAINT "duty_assignment_bulk_replace_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_assignment_bulk_replace_item" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "duty_assignment_id" INTEGER NOT NULL,
    "previous_duty_type_id" INTEGER NOT NULL,

    CONSTRAINT "duty_assignment_bulk_replace_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "duty_assignment_bulk_replace_batch_executed_at_idx" ON "duty_assignment_bulk_replace_batch"("executed_at");

-- CreateIndex
CREATE INDEX "duty_assignment_bulk_replace_item_batch_id_idx" ON "duty_assignment_bulk_replace_item"("batch_id");

-- AddForeignKey
ALTER TABLE "duty_assignment_bulk_replace_item" ADD CONSTRAINT "duty_assignment_bulk_replace_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "duty_assignment_bulk_replace_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
