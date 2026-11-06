import { describe, it, expect } from '@jest/globals';
import {
  BalanceRecord,
  computeBalanceSheet,
  computeCashFlowStatement,
  computeIncomeStatement,
  monetaryFunds,
} from './report-calculator';

function bal(partial: Partial<BalanceRecord> & { code: string }): BalanceRecord {
  return {
    name: partial.code,
    category: 'asset',
    balanceSide: 'debit',
    initialDebit: '0',
    initialCredit: '0',
    debit: '0',
    credit: '0',
    finalDebit: '0',
    finalCredit: '0',
    ...partial,
  };
}

/** 一组借贷平衡的企业会计准则余额数据 */
function enterpriseBalances(): BalanceRecord[] {
  return [
    // 资产
    bal({ code: '1001', name: '库存现金', category: 'asset', balanceSide: 'debit', initialDebit: '500', finalDebit: '1000' }),
    bal({ code: '1002', name: '银行存款', category: 'asset', balanceSide: 'debit', initialDebit: '7500', finalDebit: '9000' }),
    bal({ code: '1601', name: '固定资产', category: 'asset', balanceSide: 'debit', finalDebit: '50000' }),
    bal({ code: '1602', name: '累计折旧', category: 'asset', balanceSide: 'credit', finalCredit: '5000' }),
    // 负债
    bal({ code: '2001', name: '短期借款', category: 'liability', balanceSide: 'credit', finalCredit: '10000' }),
    // 权益
    bal({ code: '4001', name: '实收资本', category: 'equity', balanceSide: 'credit', finalCredit: '40000' }),
    // 损益（本期发生额 = 期末余额，未结转）
    bal({ code: '6001', name: '主营业务收入', category: 'pnl', balanceSide: 'credit', credit: '20000', finalCredit: '20000' }),
    bal({ code: '6401', name: '主营业务成本', category: 'pnl', balanceSide: 'debit', debit: '12000', finalDebit: '12000' }),
    bal({ code: '6602', name: '管理费用', category: 'pnl', balanceSide: 'debit', debit: '3000', finalDebit: '3000' }),
  ];
}

describe('computeBalanceSheet', () => {
  it('资产负债表平衡：资产总计 = 负债合计 + 所有者权益合计', () => {
    const report = computeBalanceSheet('enterprise', enterpriseBalances());

    expect(report.balanced).toBe(true);
    expect(report.difference).toBe('0.00');
    expect(report.totalAssets).toBe('55000.00');
    expect(report.totalLiabilitiesAndEquity).toBe('55000.00');
  });

  it('固定资产列净额 = 固定资产 - 累计折旧', () => {
    const report = computeBalanceSheet('enterprise', enterpriseBalances());
    const fixedAsset = report.assets.lines.find((l) => l.label === '固定资产');
    expect(fixedAsset).toBeDefined();
    expect(fixedAsset!.value).toBe('45000.00');
  });

  it('未分配利润包含未结转损益（净利润 5000）', () => {
    const report = computeBalanceSheet('enterprise', enterpriseBalances());
    const undistributed = report.equity.lines.find(
      (l) => l.label === '未分配利润',
    );
    expect(undistributed).toBeDefined();
    expect(undistributed!.value).toBe('5000.00');
  });
});

describe('computeIncomeStatement', () => {
  it('多步式利润表净利润计算正确', () => {
    const report = computeIncomeStatement('enterprise', enterpriseBalances());
    const operating = report.rows.find((r) => r.label === '二、营业利润');
    const net = report.rows.find((r) => r.label === '四、净利润');

    expect(operating!.value).toBe('5000.00');
    expect(net!.value).toBe('5000.00');
    expect(report.netProfit).toBe('5000.00');
  });

  it('净利润勾稽到资产负债表未分配利润', () => {
    const income = computeIncomeStatement('enterprise', enterpriseBalances());
    const balance = computeBalanceSheet('enterprise', enterpriseBalances());
    const undistributed = balance.equity.lines.find(
      (l) => l.label === '未分配利润',
    );

    // 未分配利润 = 实收资本之外的留存收益，此处无利润分配/本年利润，
    // 未分配利润金额应等于利润表净利润。
    expect(undistributed!.value).toBe(income.netProfit);
  });
});

describe('computeCashFlowStatement', () => {
  it('期末现金及现金等价物 = 货币资金科目余额', () => {
    const balances = enterpriseBalances();
    const funds = monetaryFunds(balances);
    // 货币资金 = 库存现金 1000 + 银行存款 9000
    expect(funds.ending).toBe('10000.00');
    expect(funds.beginning).toBe('8000.00');
  });

  it('三大活动净额与现金净增加额勾稽一致', () => {
    const report = computeCashFlowStatement(
      'enterprise',
      [
        { id: 1, code: '01', name: '销售商品收到的现金', category: 'operating' },
        { id: 2, code: '02', name: '购买商品支付的现金', category: 'operating' },
        { id: 3, code: '03', name: '购建固定资产支付的现金', category: 'investing' },
      ],
      [
        { cashflowItemId: 1, direction: 'debit', amount: '3000' },
        { cashflowItemId: 2, direction: 'credit', amount: '1000' },
        { cashflowItemId: 3, direction: 'credit', amount: '500' },
      ],
      '8000',
      '9500',
    );

    expect(report.netIncrease).toBe('1500.00');
    expect(report.endingCash).toBe('9500.00');
    expect(report.beginningCash).toBe('8000.00');
    expect(report.reconciled).toBe(true);
    expect(report.difference).toBe('0.00');
  });
});
