-- =============================================================
-- 账本记账系统 (ZhangBen) 数据库 Schema v1
-- 金额一律 NUMERIC(18,2)，禁浮点；所有业务表按账套(book_id)隔离
-- =============================================================

-- 用户与权限
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    display_name  VARCHAR(100),
    role          VARCHAR(20)  NOT NULL,           -- admin|bookkeeper|approver|poster|viewer
    enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 审计日志
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id),
    action      VARCHAR(50) NOT NULL,               -- CREATE|UPDATE|DELETE|APPROVE|POST|REVERSE|CLOSE...
    entity_type VARCHAR(50),
    entity_id   BIGINT,
    before_json JSONB,
    after_json  JSONB,
    ip          VARCHAR(50),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 账套
CREATE TABLE account_book (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    accounting_standard VARCHAR(20) NOT NULL,       -- enterprise|small
    base_currency      CHAR(3)      NOT NULL DEFAULT 'CNY',
    start_date         DATE         NOT NULL,
    end_date           DATE         NOT NULL,
    is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 会计科目
CREATE TABLE account (
    id              BIGSERIAL PRIMARY KEY,
    book_id         BIGINT        NOT NULL REFERENCES account_book(id),
    code            VARCHAR(50)   NOT NULL,
    name            VARCHAR(100)  NOT NULL,
    category        VARCHAR(20)   NOT NULL,         -- asset|liability|common|equity|cost|pnl
    balance_side    VARCHAR(10)   NOT NULL,         -- debit|credit
    level           INT           NOT NULL DEFAULT 1,
    parent_id       BIGINT REFERENCES account(id),
    is_leaf         BOOLEAN       NOT NULL DEFAULT TRUE,
    aux_flags       JSONB,                          -- ["customer","supplier","department","employee","project","cashflow"]
    is_quantity     BOOLEAN       NOT NULL DEFAULT FALSE,
    is_foreign      BOOLEAN       NOT NULL DEFAULT FALSE,
    initial_debit   NUMERIC(18,2) NOT NULL DEFAULT 0,
    initial_credit  NUMERIC(18,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_account_code UNIQUE (book_id, code)
);
CREATE INDEX idx_account_parent ON account(parent_id);

-- 辅助核算项
CREATE TABLE auxiliary_item (
    id        BIGSERIAL PRIMARY KEY,
    book_id   BIGINT       NOT NULL REFERENCES account_book(id),
    aux_type  VARCHAR(20)  NOT NULL,                -- customer|supplier|department|employee|project
    code      VARCHAR(50)  NOT NULL,
    name      VARCHAR(100) NOT NULL,
    is_active BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_aux_item UNIQUE (book_id, aux_type, code)
);

-- 现金流量项目
CREATE TABLE cash_flow_item (
    id        BIGSERIAL PRIMARY KEY,
    book_id   BIGINT       NOT NULL REFERENCES account_book(id),
    code      VARCHAR(50)  NOT NULL,
    name      VARCHAR(100) NOT NULL,
    category  VARCHAR(20)  NOT NULL,                -- operating|investing|financing
    is_active BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_cashflow_code UNIQUE (book_id, code)
);

-- 记账凭证（头）
CREATE TABLE voucher (
    id               BIGSERIAL PRIMARY KEY,
    book_id          BIGINT      NOT NULL REFERENCES account_book(id),
    period           CHAR(7)     NOT NULL,          -- YYYY-MM
    date             DATE        NOT NULL,
    voucher_type     VARCHAR(10) NOT NULL,          -- 记|收|付|转
    voucher_no       INT         NOT NULL,
    attachment_count INT         NOT NULL DEFAULT 0,
    status           VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft|submitted|approved|posted|voided
    source           VARCHAR(20) NOT NULL DEFAULT 'manual', -- manual|closing|depreciation|auto
    creator_id       BIGINT REFERENCES users(id),
    reviewer_id      BIGINT REFERENCES users(id),
    poster_id        BIGINT REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    posted_at        TIMESTAMPTZ,
    CONSTRAINT uq_voucher_no UNIQUE (book_id, period, voucher_type, voucher_no)
);
CREATE INDEX idx_voucher_period ON voucher(book_id, period);

-- 记账凭证（分录体）
CREATE TABLE voucher_entry (
    id               BIGSERIAL PRIMARY KEY,
    voucher_id       BIGINT       NOT NULL REFERENCES voucher(id) ON DELETE CASCADE,
    line_no          INT          NOT NULL,
    summary          VARCHAR(200) NOT NULL,
    account_id       BIGINT       NOT NULL REFERENCES account(id),
    direction        VARCHAR(10)  NOT NULL,         -- debit|credit
    amount           NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
    original_amount  NUMERIC(18,2),
    exchange_rate    NUMERIC(10,6),
    cashflow_item_id BIGINT REFERENCES cash_flow_item(id),
    CONSTRAINT uq_entry_line UNIQUE (voucher_id, line_no)
);
CREATE INDEX idx_entry_account ON voucher_entry(account_id);

-- 分录辅助核算明细
CREATE TABLE voucher_entry_aux (
    id                BIGSERIAL PRIMARY KEY,
    entry_id          BIGINT      NOT NULL REFERENCES voucher_entry(id) ON DELETE CASCADE,
    aux_type          VARCHAR(20) NOT NULL,
    auxiliary_item_id BIGINT      NOT NULL REFERENCES auxiliary_item(id),
    CONSTRAINT uq_entry_aux UNIQUE (entry_id, aux_type, auxiliary_item_id)
);

-- 科目余额（按期间物化快照）
CREATE TABLE account_balance (
    id             BIGSERIAL PRIMARY KEY,
    book_id        BIGINT   NOT NULL REFERENCES account_book(id),
    period         CHAR(7)  NOT NULL,
    account_id     BIGINT   NOT NULL REFERENCES account(id),
    initial_debit  NUMERIC(18,2) NOT NULL DEFAULT 0,
    initial_credit NUMERIC(18,2) NOT NULL DEFAULT 0,
    debit          NUMERIC(18,2) NOT NULL DEFAULT 0,   -- 本期借方发生额
    credit         NUMERIC(18,2) NOT NULL DEFAULT 0,   -- 本期贷方发生额
    final_debit    NUMERIC(18,2) NOT NULL DEFAULT 0,
    final_credit   NUMERIC(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT uq_balance UNIQUE (book_id, period, account_id)
);

-- 会计期间
CREATE TABLE period (
    id          BIGSERIAL PRIMARY KEY,
    book_id     BIGINT      NOT NULL REFERENCES account_book(id),
    period      CHAR(7)     NOT NULL,
    status      VARCHAR(10) NOT NULL DEFAULT 'open',   -- open|closed
    is_year_end BOOLEAN     NOT NULL DEFAULT FALSE,
    closed_by   BIGINT REFERENCES users(id),
    closed_at   TIMESTAMPTZ,
    CONSTRAINT uq_period UNIQUE (book_id, period)
);

-- 固定资产卡片
CREATE TABLE asset (
    id                                BIGSERIAL PRIMARY KEY,
    book_id                           BIGINT        NOT NULL REFERENCES account_book(id),
    code                              VARCHAR(50)   NOT NULL,
    name                              VARCHAR(100)  NOT NULL,
    category                          VARCHAR(50),
    original_value                    NUMERIC(18,2) NOT NULL,
    residual_rate                     NUMERIC(8,4)  NOT NULL DEFAULT 0.05,
    useful_life                       INT           NOT NULL,      -- 月
    depreciation_method               VARCHAR(20)   NOT NULL DEFAULT 'straight_line',
    start_date                        DATE          NOT NULL,
    depreciation_account_id           BIGINT        NOT NULL REFERENCES account(id),
    accumulated_depreciation_account_id BIGINT      NOT NULL REFERENCES account(id),
    is_active                         BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_asset_code UNIQUE (book_id, code)
);

-- 固定资产折旧
CREATE TABLE asset_depreciation (
    id         BIGSERIAL PRIMARY KEY,
    asset_id   BIGINT        NOT NULL REFERENCES asset(id),
    period     CHAR(7)       NOT NULL,
    amount     NUMERIC(18,2) NOT NULL,
    voucher_id BIGINT REFERENCES voucher(id),
    CONSTRAINT uq_asset_depr UNIQUE (asset_id, period)
);

-- 报表模板（财会2019/财会2026/小企业 切换）
CREATE TABLE report_template (
    id       BIGSERIAL PRIMARY KEY,
    book_id  BIGINT REFERENCES account_book(id),      -- NULL = 全局内置
    standard VARCHAR(20)  NOT NULL,                   -- cas2019|cas2026|small
    name     VARCHAR(100) NOT NULL,
    body     JSONB        NOT NULL
);
