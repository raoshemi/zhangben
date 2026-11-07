-- CreateTable
CREATE TABLE "opening_balance_aux" (
    "id" SERIAL NOT NULL,
    "book_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "aux_type" VARCHAR(20) NOT NULL,
    "aux_item_id" INTEGER NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opening_balance_aux_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oba_unique" ON "opening_balance_aux"("book_id", "account_id", "aux_type", "aux_item_id");

-- AddForeignKey
ALTER TABLE "opening_balance_aux" ADD CONSTRAINT "opening_balance_aux_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "account_book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_balance_aux" ADD CONSTRAINT "opening_balance_aux_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_balance_aux" ADD CONSTRAINT "opening_balance_aux_aux_item_id_fkey" FOREIGN KEY ("aux_item_id") REFERENCES "auxiliary_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
