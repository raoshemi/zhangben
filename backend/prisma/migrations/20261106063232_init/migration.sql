-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(100),
    "role" VARCHAR(20) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" INTEGER,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_book" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "accounting_standard" VARCHAR(20) NOT NULL,
    "base_currency" VARCHAR(3) NOT NULL DEFAULT 'CNY',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" SERIAL NOT NULL,
    "book_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "balance_side" VARCHAR(10) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "parent_id" INTEGER,
    "is_leaf" BOOLEAN NOT NULL DEFAULT true,
    "aux_flags" JSONB,
    "is_quantity" BOOLEAN NOT NULL DEFAULT false,
    "is_foreign" BOOLEAN NOT NULL DEFAULT false,
    "initial_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "initial_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxiliary_item" (
    "id" SERIAL NOT NULL,
    "book_id" INTEGER NOT NULL,
    "aux_type" VARCHAR(20) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "auxiliary_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_flow_item" (
    "id" SERIAL NOT NULL,
    "book_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cash_flow_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher" (
    "id" SERIAL NOT NULL,
    "book_id" INTEGER NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "date" DATE NOT NULL,
    "voucher_type" VARCHAR(10) NOT NULL,
    "voucher_no" INTEGER NOT NULL,
    "attachment_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "creator_id" INTEGER,
    "reviewer_id" INTEGER,
    "poster_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMPTZ(6),

    CONSTRAINT "voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_entry" (
    "id" SERIAL NOT NULL,
    "voucher_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "summary" VARCHAR(200) NOT NULL,
    "account_id" INTEGER NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "original_amount" DECIMAL(18,2),
    "exchange_rate" DECIMAL(10,6),
    "cashflow_item_id" INTEGER,

    CONSTRAINT "voucher_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_entry_aux" (
    "id" SERIAL NOT NULL,
    "entry_id" INTEGER NOT NULL,
    "aux_type" VARCHAR(20) NOT NULL,
    "auxiliary_item_id" INTEGER NOT NULL,

    CONSTRAINT "voucher_entry_aux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balance" (
    "id" SERIAL NOT NULL,
    "book_id" INTEGER NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "account_id" INTEGER NOT NULL,
    "initial_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "initial_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "final_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "final_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "account_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period" (
    "id" SERIAL NOT NULL,
    "book_id" INTEGER NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'open',
    "is_year_end" BOOLEAN NOT NULL DEFAULT false,
    "closed_by" INTEGER,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" SERIAL NOT NULL,
    "book_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50),
    "original_value" DECIMAL(18,2) NOT NULL,
    "residual_rate" DECIMAL(8,4) NOT NULL DEFAULT 0.05,
    "useful_life" INTEGER NOT NULL,
    "depreciation_method" VARCHAR(20) NOT NULL DEFAULT 'straight_line',
    "start_date" DATE NOT NULL,
    "depreciation_account_id" INTEGER NOT NULL,
    "accumulated_depreciation_account_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_depreciation" (
    "id" SERIAL NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "voucher_id" INTEGER,

    CONSTRAINT "asset_depreciation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_template" (
    "id" SERIAL NOT NULL,
    "book_id" INTEGER,
    "standard" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "body" JSONB NOT NULL,

    CONSTRAINT "report_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "account_book_id_code_key" ON "account"("book_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "auxiliary_item_book_id_aux_type_code_key" ON "auxiliary_item"("book_id", "aux_type", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cash_flow_item_book_id_code_key" ON "cash_flow_item"("book_id", "code");

-- CreateIndex
CREATE INDEX "voucher_book_id_period_idx" ON "voucher"("book_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_book_id_period_voucher_type_voucher_no_key" ON "voucher"("book_id", "period", "voucher_type", "voucher_no");

-- CreateIndex
CREATE INDEX "voucher_entry_account_id_idx" ON "voucher_entry"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_entry_voucher_id_line_no_key" ON "voucher_entry"("voucher_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_entry_aux_entry_id_aux_type_auxiliary_item_id_key" ON "voucher_entry_aux"("entry_id", "aux_type", "auxiliary_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_balance_book_id_period_account_id_key" ON "account_balance"("book_id", "period", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "period_book_id_period_key" ON "period"("book_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "asset_book_id_code_key" ON "asset"("book_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "asset_depreciation_asset_id_period_key" ON "asset_depreciation"("asset_id", "period");

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "account_book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auxiliary_item" ADD CONSTRAINT "auxiliary_item_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "account_book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_flow_item" ADD CONSTRAINT "cash_flow_item_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "account_book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher" ADD CONSTRAINT "voucher_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "account_book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher" ADD CONSTRAINT "voucher_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher" ADD CONSTRAINT "voucher_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher" ADD CONSTRAINT "voucher_poster_id_fkey" FOREIGN KEY ("poster_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_entry" ADD CONSTRAINT "voucher_entry_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_entry" ADD CONSTRAINT "voucher_entry_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_entry" ADD CONSTRAINT "voucher_entry_cashflow_item_id_fkey" FOREIGN KEY ("cashflow_item_id") REFERENCES "cash_flow_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_entry_aux" ADD CONSTRAINT "voucher_entry_aux_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "voucher_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_entry_aux" ADD CONSTRAINT "voucher_entry_aux_auxiliary_item_id_fkey" FOREIGN KEY ("auxiliary_item_id") REFERENCES "auxiliary_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balance" ADD CONSTRAINT "account_balance_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "account_book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balance" ADD CONSTRAINT "account_balance_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period" ADD CONSTRAINT "period_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "account_book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period" ADD CONSTRAINT "period_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "account_book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_depreciation_account_id_fkey" FOREIGN KEY ("depreciation_account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_accumulated_depreciation_account_id_fkey" FOREIGN KEY ("accumulated_depreciation_account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_depreciation" ADD CONSTRAINT "asset_depreciation_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_depreciation" ADD CONSTRAINT "asset_depreciation_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_template" ADD CONSTRAINT "report_template_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "account_book"("id") ON DELETE SET NULL ON UPDATE CASCADE;
