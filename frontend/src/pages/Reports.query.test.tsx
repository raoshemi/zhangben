import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Reports from './Reports';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const balance = {
  bookId: 1,
  period: '2026-01',
  standard: 'enterprise',
  assets: { lines: [{ label: '货币资金', value: '100.00', type: 'item' }], total: '100.00' },
  liabilities: { lines: [], total: '0.00' },
  equity: { lines: [], total: '100.00' },
  totalAssets: '100.00',
  totalLiabilitiesAndEquity: '100.00',
  balanced: true,
  difference: '0.00',
};

const income = {
  bookId: 1,
  period: '2026-01',
  standard: 'enterprise',
  rows: [{ label: '营业收入', value: '1234.00', type: 'item' }],
  netProfit: '1234.00',
};

const cashflow = {
  bookId: 1,
  period: '2026-01',
  standard: 'enterprise',
  operating: { lines: [], total: '0.00' },
  investing: { lines: [], total: '0.00' },
  financing: { lines: [], total: '0.00' },
  netIncrease: '0.00',
  beginningCash: '0.00',
  endingCash: '100.00',
  reconciled: true,
  difference: '0.00',
};

const reportCalls = () =>
  (api.get as jest.Mock).mock.calls.filter((c) => String(c[0]).startsWith('/reports'))
    .length;

describe('Reports 一次查询加载三张报表', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/books') {
        return Promise.resolve({
          data: [{ id: 1, name: '测试账套', accountingStandard: 'enterprise' }],
        });
      }
      if (url === '/reports/balance-sheet') return Promise.resolve({ data: balance });
      if (url === '/reports/income-statement') return Promise.resolve({ data: income });
      if (url === '/reports/cash-flow') return Promise.resolve({ data: cashflow });
      return Promise.resolve({ data: [] });
    });
  });

  it('默认账套自动查询，三张报表并发加载，切换标签不再发请求', async () => {
    const user = userEvent.setup();
    render(<Reports />);

    // 资产负债表默认标签直接展示
    expect(await screen.findByText('资产总计')).toBeInTheDocument();
    expect(await screen.findByText('勾稽校验通过：资产总计 = 负债合计 + 所有者权益合计')).toBeInTheDocument();
    // 三张表在点击「查询」之前就已全部取回
    expect(reportCalls()).toBe(3);

    // 切到利润表：直接展示，无新请求
    await user.click(screen.getByText('利润表'));
    expect(await screen.findByText('本期净利润：1234.00 元')).toBeInTheDocument();
    expect(reportCalls()).toBe(3);

    // 切到现金流量表：同样直接展示
    await user.click(screen.getByText('现金流量表'));
    expect(await screen.findByText('二、投资活动产生的现金流量')).toBeInTheDocument();
    expect(reportCalls()).toBe(3);
  });

  it('单张报表失败只影响该标签，并可单独重试', async () => {
    const user = userEvent.setup();
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/books') {
        return Promise.resolve({
          data: [{ id: 1, name: '测试账套', accountingStandard: 'enterprise' }],
        });
      }
      if (url === '/reports/income-statement') {
        return Promise.reject({ response: { data: { message: '利润表取数失败' } } });
      }
      if (url === '/reports/balance-sheet') return Promise.resolve({ data: balance });
      return Promise.resolve({ data: cashflow });
    });

    render(<Reports />);
    expect(await screen.findByText('资产总计')).toBeInTheDocument();

    await user.click(screen.getByText('利润表'));
    expect(await screen.findByText('利润表加载失败')).toBeInTheDocument();
    expect(await screen.findByText('利润表取数失败')).toBeInTheDocument();
  });
});
