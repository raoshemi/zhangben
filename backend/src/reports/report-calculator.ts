import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;
type D = Prisma.Decimal;

export type AccountingStandard = 'enterprise' | 'small';

/**
 * 科目余额（按期间解析后统一结构）。金额字段为字符串或 Decimal，
 * 计算一律使用 Decimal，禁止浮点。
 */
export interface BalanceRecord {
  code: string;
  name: string;
  category: string; // asset|liability|common|equity|cost|pnl
  balanceSide: string; // debit|credit
  initialDebit: string | D;
  initialCredit: string | D;
  debit: string | D; // 本期借方发生额
  credit: string | D; // 本期贷方发生额
  finalDebit: string | D; // 期末借方余额
  finalCredit: string | D; // 期末贷方余额
}

export interface ReportRow {
  label: string;
  value: string;
  type: 'item' | 'subtotal' | 'total';
}

export interface ReportSection {
  lines: ReportRow[];
  total: string;
}

export interface BalanceSheetResult {
  standard: AccountingStandard;
  assets: ReportSection;
  liabilities: ReportSection;
  equity: ReportSection;
  totalAssets: string;
  totalLiabilitiesAndEquity: string;
  balanced: boolean;
  difference: string;
}

export interface IncomeStatementResult {
  standard: AccountingStandard;
  rows: ReportRow[];
  netProfit: string;
}

export interface CashFlowItemInput {
  id: number;
  code: string;
  name: string;
  category: string; // operating|investing|financing
}

export interface CashFlowEntryInput {
  cashflowItemId: number;
  direction: string; // debit|credit
  amount: string | D;
}

export interface CashFlowResult {
  standard: AccountingStandard;
  operating: ReportSection;
  investing: ReportSection;
  financing: ReportSection;
  netIncrease: string;
  beginningCash: string;
  endingCash: string;
  reconciled: boolean;
  difference: string;
}

// ---------- Decimal 工具 ----------
function d(v: string | D | number | null | undefined): D {
  if (v == null) return new Decimal(0);
  return new Decimal(v);
}

function round2(x: D): string {
  return x.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

// 期末借方净额（正值表示借方）
function netDebit(b: BalanceRecord): D {
  return d(b.finalDebit).minus(d(b.finalCredit));
}

// 本期发生额：贷方净额（收入口径）
function netOccurrenceCredit(b: BalanceRecord): D {
  return d(b.credit).minus(d(b.debit));
}

// 本期发生额：借方净额（费用口径）
function netOccurrenceDebit(b: BalanceRecord): D {
  return d(b.debit).minus(d(b.credit));
}

function matches(code: string, lineCode: string): boolean {
  return code === lineCode || code.startsWith(lineCode);
}

function sumDebitSide(balances: BalanceRecord[], codes: string[]): D {
  let total = new Decimal(0);
  for (const b of balances) {
    if (codes.some((c) => matches(b.code, c))) {
      total = total.plus(netDebit(b));
    }
  }
  return total;
}

function sumCreditSide(balances: BalanceRecord[], codes: string[]): D {
  return sumDebitSide(balances, codes).negated();
}

function sumIncomeOccurrence(balances: BalanceRecord[], codes: string[]): D {
  let total = new Decimal(0);
  for (const b of balances) {
    if (codes.some((c) => matches(b.code, c))) {
      total = total.plus(netOccurrenceCredit(b));
    }
  }
  return total;
}

function sumExpenseOccurrence(balances: BalanceRecord[], codes: string[]): D {
  let total = new Decimal(0);
  for (const b of balances) {
    if (codes.some((c) => matches(b.code, c))) {
      total = total.plus(netOccurrenceDebit(b));
    }
  }
  return total;
}

// 按科目类别归集的期末净值（用于试算平衡 / 合计行兜底）
function categoryNetDebit(balances: BalanceRecord[], categories: string[]): D {
  let total = new Decimal(0);
  for (const b of balances) {
    if (categories.includes(b.category)) {
      total = total.plus(netDebit(b));
    }
  }
  return total;
}

// ---------- 报表行定义 ----------
interface LineDef {
  label: string;
  codes: string[];
  side: 'debit' | 'credit';
}

interface SectionDef {
  current: LineDef[];
  nonCurrent?: LineDef[];
}

interface StandardLineDefs {
  assets: SectionDef;
  liabilities: SectionDef;
  equity: LineDef[];
  pnlCodes: string[];
}

const ENTERPRISE_PNL_CODES = [
  '6001', '6051', '6101', '6111', '6115', '6117', '6301',
  '6401', '6402', '6403', '6601', '6602', '6603',
  '6701', '6711', '6801', '6901',
];

const SMALL_PNL_CODES = [
  '5001', '5051', '5111', '5301',
  '5401', '5402', '5403', '5601', '5602', '5603',
  '5711', '5801',
];

function lineDefs(standard: AccountingStandard): StandardLineDefs {
  if (standard === 'small') {
    return {
      assets: {
        current: [
          { label: '货币资金', codes: ['1001', '1002', '1012'], side: 'debit' },
          { label: '短期投资', codes: ['1101'], side: 'debit' },
          { label: '应收票据', codes: ['1121'], side: 'debit' },
          { label: '应收账款', codes: ['1122'], side: 'debit' },
          { label: '预付账款', codes: ['1123'], side: 'debit' },
          { label: '应收股利', codes: ['1131'], side: 'debit' },
          { label: '应收利息', codes: ['1132'], side: 'debit' },
          { label: '其他应收款', codes: ['1221'], side: 'debit' },
          { label: '存货', codes: ['1401', '1402', '1403', '1404', '1405', '1407', '1408', '1411', '1421', '4001', '4101', '4401', '4403'], side: 'debit' },
        ],
        nonCurrent: [
          { label: '长期债券投资', codes: ['1501'], side: 'debit' },
          { label: '长期股权投资', codes: ['1511'], side: 'debit' },
          { label: '固定资产', codes: ['1601', '1602'], side: 'debit' },
          { label: '在建工程', codes: ['1604'], side: 'debit' },
          { label: '工程物资', codes: ['1605'], side: 'debit' },
          { label: '固定资产清理', codes: ['1606'], side: 'debit' },
          { label: '生产性生物资产', codes: ['1621', '1622'], side: 'debit' },
          { label: '无形资产', codes: ['1701', '1702'], side: 'debit' },
          { label: '长期待摊费用', codes: ['1801'], side: 'debit' },
          { label: '开发支出', codes: ['4301'], side: 'debit' },
          { label: '待处理财产损溢', codes: ['1901'], side: 'debit' },
        ],
      },
      liabilities: {
        current: [
          { label: '短期借款', codes: ['2001'], side: 'credit' },
          { label: '应付票据', codes: ['2201'], side: 'credit' },
          { label: '应付账款', codes: ['2202'], side: 'credit' },
          { label: '预收账款', codes: ['2203'], side: 'credit' },
          { label: '应付职工薪酬', codes: ['2211'], side: 'credit' },
          { label: '应交税费', codes: ['2221'], side: 'credit' },
          { label: '应付利息', codes: ['2231'], side: 'credit' },
          { label: '应付利润', codes: ['2232'], side: 'credit' },
          { label: '其他应付款', codes: ['2241'], side: 'credit' },
        ],
        nonCurrent: [
          { label: '递延收益', codes: ['2401'], side: 'credit' },
          { label: '长期借款', codes: ['2501'], side: 'credit' },
          { label: '长期应付款', codes: ['2701'], side: 'credit' },
        ],
      },
      equity: [
        { label: '实收资本', codes: ['3001'], side: 'credit' },
        { label: '资本公积', codes: ['3002'], side: 'credit' },
        { label: '盈余公积', codes: ['3101'], side: 'credit' },
        // 未分配利润 = 本年利润 + 利润分配 + 未结转损益
        { label: '未分配利润', codes: ['3103', '3104', ...SMALL_PNL_CODES], side: 'credit' },
      ],
      pnlCodes: SMALL_PNL_CODES,
    };
  }

  return {
    assets: {
      current: [
        { label: '货币资金', codes: ['1001', '1002', '1012'], side: 'debit' },
        { label: '应收票据', codes: ['1121'], side: 'debit' },
        { label: '应收账款', codes: ['1122', '1231'], side: 'debit' },
        { label: '预付账款', codes: ['1123'], side: 'debit' },
        { label: '应收股利', codes: ['1131'], side: 'debit' },
        { label: '应收利息', codes: ['1132'], side: 'debit' },
        { label: '其他应收款', codes: ['1221'], side: 'debit' },
        { label: '存货', codes: ['5001', '5101', '5201'], side: 'debit' },
      ],
      nonCurrent: [
        { label: '长期股权投资', codes: ['1511'], side: 'debit' },
        { label: '投资性房地产', codes: ['1521'], side: 'debit' },
        { label: '固定资产', codes: ['1601', '1602', '1603'], side: 'debit' },
        { label: '在建工程', codes: ['1604'], side: 'debit' },
        { label: '固定资产清理', codes: ['1606'], side: 'debit' },
        { label: '无形资产', codes: ['1701', '1702'], side: 'debit' },
        { label: '商誉', codes: ['1711'], side: 'debit' },
        { label: '长期待摊费用', codes: ['1801'], side: 'debit' },
        { label: '递延所得税资产', codes: ['1811'], side: 'debit' },
        { label: '开发支出', codes: ['5301'], side: 'debit' },
        { label: '待处理财产损溢', codes: ['1901'], side: 'debit' },
      ],
    },
    liabilities: {
      current: [
        { label: '短期借款', codes: ['2001'], side: 'credit' },
        { label: '应付票据', codes: ['2201'], side: 'credit' },
        { label: '应付账款', codes: ['2202'], side: 'credit' },
        { label: '预收账款', codes: ['2203'], side: 'credit' },
        { label: '应付职工薪酬', codes: ['2211'], side: 'credit' },
        { label: '应交税费', codes: ['2221'], side: 'credit' },
        { label: '应付利息', codes: ['2231'], side: 'credit' },
        { label: '应付股利', codes: ['2232'], side: 'credit' },
        { label: '其他应付款', codes: ['2241'], side: 'credit' },
      ],
      nonCurrent: [
        { label: '长期借款', codes: ['2501'], side: 'credit' },
        { label: '长期应付款', codes: ['2701'], side: 'credit' },
        { label: '预计负债', codes: ['2801'], side: 'credit' },
        { label: '递延所得税负债', codes: ['2901'], side: 'credit' },
      ],
    },
    equity: [
      { label: '实收资本', codes: ['4001'], side: 'credit' },
      { label: '资本公积', codes: ['4002'], side: 'credit' },
      { label: '盈余公积', codes: ['4101'], side: 'credit' },
      { label: '未分配利润', codes: ['4103', '4104', ...ENTERPRISE_PNL_CODES], side: 'credit' },
      { label: '库存股', codes: ['4201'], side: 'credit' },
    ],
    pnlCodes: ENTERPRISE_PNL_CODES,
  };
}

function lineValue(balances: BalanceRecord[], def: LineDef): D {
  return def.side === 'debit'
    ? sumDebitSide(balances, def.codes)
    : sumCreditSide(balances, def.codes);
}

// ---------- 资产负债表 ----------
export function computeBalanceSheet(
  standard: AccountingStandard,
  balances: BalanceRecord[],
): BalanceSheetResult {
  const defs = lineDefs(standard);

  const buildSection = (
    section: SectionDef,
    authoritativeTotal: D,
    labels: { current: string; nonCurrent: string; other: string },
  ): ReportSection => {
    const lines: ReportRow[] = [];
    let currentTotal = new Decimal(0);
    for (const def of section.current) {
      const v = lineValue(balances, def);
      currentTotal = currentTotal.plus(v);
      lines.push({ label: def.label, value: round2(v), type: 'item' });
    }
    lines.push({ label: labels.current, value: round2(currentTotal), type: 'subtotal' });

    let nonCurrentTotal = new Decimal(0);
    if (section.nonCurrent && section.nonCurrent.length > 0) {
      for (const def of section.nonCurrent) {
        const v = lineValue(balances, def);
        nonCurrentTotal = nonCurrentTotal.plus(v);
        lines.push({ label: def.label, value: round2(v), type: 'item' });
      }
    }
    // 未映射到明细行的科目余额，归入“其他”，保证明细自洽
    const other = authoritativeTotal.minus(currentTotal).minus(nonCurrentTotal);
    if (!other.isZero()) {
      lines.push({ label: labels.other, value: round2(other), type: 'item' });
      nonCurrentTotal = nonCurrentTotal.plus(other);
    }
    lines.push({ label: labels.nonCurrent, value: round2(nonCurrentTotal), type: 'subtotal' });

    return { lines, total: round2(authoritativeTotal) };
  };

  // 资产：全部资产类 + 成本类（兜底，保证资产总计 = 该类科目期末借方合计）
  const totalAssets = categoryNetDebit(balances, ['asset', 'cost']);
  const assets = buildSection(defs.assets, totalAssets, {
    current: '流动资产合计',
    nonCurrent: '非流动资产合计',
    other: '其他非流动资产',
  });

  const totalLiabilities = categoryNetDebit(balances, ['liability']).negated();
  const liabilities = buildSection(defs.liabilities, totalLiabilities, {
    current: '流动负债合计',
    nonCurrent: '非流动负债合计',
    other: '其他非流动负债',
  });

  const equityLines: ReportRow[] = [];
  let equityMapped = new Decimal(0);
  for (const def of defs.equity) {
    const v = lineValue(balances, def);
    equityMapped = equityMapped.plus(v);
    equityLines.push({ label: def.label, value: round2(v), type: 'item' });
  }
  // 权益合计 = 全部权益类(贷方) + 损益类(未结转利润，贷方口径)
  const totalEquity = categoryNetDebit(balances, ['equity'])
    .negated()
    .plus(categoryNetDebit(balances, ['pnl']).negated());
  const equityOther = totalEquity.minus(equityMapped);
  if (!equityOther.isZero()) {
    equityLines.push({ label: '其他', value: round2(equityOther), type: 'item' });
  }
  equityLines.push({ label: '所有者权益合计', value: round2(totalEquity), type: 'total' });

  const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);
  const difference = totalAssets.minus(totalLiabilitiesAndEquity);

  return {
    standard,
    assets,
    liabilities,
    equity: { lines: equityLines, total: round2(totalEquity) },
    totalAssets: round2(totalAssets),
    totalLiabilitiesAndEquity: round2(totalLiabilitiesAndEquity),
    balanced: difference.isZero(),
    difference: round2(difference),
  };
}

// ---------- 利润表（多步式） ----------
interface IsLineDef {
  label: string;
  codes: string[];
  kind: 'income' | 'expense';
}

function incomeLineDefs(standard: AccountingStandard): IsLineDef[] {
  if (standard === 'small') {
    return [
      { label: '一、营业收入', codes: ['5001', '5051'], kind: 'income' },
      { label: '减：营业成本', codes: ['5401', '5402'], kind: 'expense' },
      { label: '税金及附加', codes: ['5403'], kind: 'expense' },
      { label: '销售费用', codes: ['5601'], kind: 'expense' },
      { label: '管理费用', codes: ['5602'], kind: 'expense' },
      { label: '财务费用', codes: ['5603'], kind: 'expense' },
      { label: '加：投资收益', codes: ['5111'], kind: 'income' },
      { label: '二、营业利润', codes: [], kind: 'expense' },
      { label: '加：营业外收入', codes: ['5301'], kind: 'income' },
      { label: '减：营业外支出', codes: ['5711'], kind: 'expense' },
      { label: '三、利润总额', codes: [], kind: 'expense' },
      { label: '减：所得税费用', codes: ['5801'], kind: 'expense' },
      { label: '四、净利润', codes: [], kind: 'expense' },
    ];
  }
  return [
    { label: '一、营业收入', codes: ['6001', '6051'], kind: 'income' },
    { label: '减：营业成本', codes: ['6401', '6402'], kind: 'expense' },
    { label: '税金及附加', codes: ['6403'], kind: 'expense' },
    { label: '销售费用', codes: ['6601'], kind: 'expense' },
    { label: '管理费用', codes: ['6602'], kind: 'expense' },
    { label: '财务费用', codes: ['6603'], kind: 'expense' },
    { label: '资产减值损失', codes: ['6701'], kind: 'expense' },
    { label: '加：其他收益', codes: ['6117'], kind: 'income' },
    { label: '投资收益', codes: ['6111'], kind: 'income' },
    { label: '公允价值变动收益', codes: ['6101'], kind: 'income' },
    { label: '资产处置收益', codes: ['6115'], kind: 'income' },
    { label: '二、营业利润', codes: [], kind: 'expense' },
    { label: '加：营业外收入', codes: ['6301'], kind: 'income' },
    { label: '减：营业外支出', codes: ['6711'], kind: 'expense' },
    { label: '三、利润总额', codes: [], kind: 'expense' },
    { label: '减：所得税费用', codes: ['6801'], kind: 'expense' },
    { label: '四、净利润', codes: [], kind: 'expense' },
  ];
}

export function computeIncomeStatement(
  standard: AccountingStandard,
  balances: BalanceRecord[],
): IncomeStatementResult {
  const defs = incomeLineDefs(standard);
  const rows: ReportRow[] = [];

  let operatingProfit = new Decimal(0);
  let totalProfit = new Decimal(0);
  let netProfit = new Decimal(0);
  let passedOperating = false;
  let passedTotal = false;

  for (const def of defs) {
    let value: D;
    if (def.label === '二、营业利润') {
      value = operatingProfit;
      passedOperating = true;
    } else if (def.label === '三、利润总额') {
      value = totalProfit;
      passedTotal = true;
    } else if (def.label === '四、净利润') {
      value = netProfit;
    } else {
      value =
        def.kind === 'income'
          ? sumIncomeOccurrence(balances, def.codes)
          : sumExpenseOccurrence(balances, def.codes);
      if (!passedOperating) {
        operatingProfit =
          def.kind === 'income'
            ? operatingProfit.plus(value)
            : operatingProfit.minus(value);
      }
      if (!passedTotal) {
        totalProfit =
          def.kind === 'income'
            ? totalProfit.plus(value)
            : totalProfit.minus(value);
      }
      netProfit =
        def.kind === 'income'
          ? netProfit.plus(value)
          : netProfit.minus(value);
    }

    const type =
      def.label === '二、营业利润' || def.label === '三、利润总额'
        ? 'subtotal'
        : def.label === '四、净利润'
          ? 'total'
          : 'item';
    rows.push({ label: def.label, value: round2(value), type });
  }

  return { standard, rows, netProfit: round2(netProfit) };
}

// ---------- 现金流量表 ----------
const CASH_ACCOUNT_CODES = ['1001', '1002', '1012'];

export function computeCashFlowStatement(
  standard: AccountingStandard,
  items: CashFlowItemInput[],
  entries: CashFlowEntryInput[],
  beginningCash: string | D,
  endingCash: string | D,
): CashFlowResult {
  const netByItem = new Map<number, D>();
  for (const e of entries) {
    const key = e.cashflowItemId;
    const amount = d(e.amount);
    const cur = netByItem.get(key) ?? new Decimal(0);
    netByItem.set(
      key,
      e.direction === 'debit' ? cur.plus(amount) : cur.minus(amount),
    );
  }

  const buildSection = (category: string): ReportSection => {
    const lines: ReportRow[] = [];
    let net = new Decimal(0);
    const categoryItems = items
      .filter((i) => i.category === category)
      .sort((a, b) => a.code.localeCompare(b.code));
    for (const item of categoryItems) {
      const value = netByItem.get(item.id) ?? new Decimal(0);
      net = net.plus(value);
      lines.push({ label: item.name, value: round2(value), type: 'item' });
    }
    lines.push({
      label: categoryLabel(category) + '产生的现金流量净额',
      value: round2(net),
      type: 'subtotal',
    });
    return { lines, total: round2(net) };
  };

  const operating = buildSection('operating');
  const investing = buildSection('investing');
  const financing = buildSection('financing');

  const netIncrease = d(operating.total)
    .plus(d(investing.total))
    .plus(d(financing.total));
  const beginning = d(beginningCash);
  const ending = d(endingCash);
  const derivedIncrease = ending.minus(beginning);
  const difference = netIncrease.minus(derivedIncrease);

  return {
    standard,
    operating,
    investing,
    financing,
    netIncrease: round2(netIncrease),
    beginningCash: round2(beginning),
    endingCash: round2(ending),
    reconciled: difference.isZero(),
    difference: round2(difference),
  };
}

function categoryLabel(category: string): string {
  if (category === 'operating') return '经营活动';
  if (category === 'investing') return '投资活动';
  return '筹资活动';
}

/** 货币资金期末余额（库存现金 + 银行存款 + 其他货币资金） */
export function monetaryFunds(balances: BalanceRecord[]): {
  beginning: string;
  ending: string;
} {
  let beginning = new Decimal(0);
  let ending = new Decimal(0);
  for (const b of balances) {
    if (CASH_ACCOUNT_CODES.some((c) => matches(b.code, c))) {
      beginning = beginning.plus(d(b.initialDebit).minus(d(b.initialCredit)));
      ending = ending.plus(netDebit(b));
    }
  }
  return { beginning: round2(beginning), ending: round2(ending) };
}
