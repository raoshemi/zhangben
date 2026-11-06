import { render, screen } from '@testing-library/react';
import VoucherList from './VoucherList';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('VoucherList 凭证序时簿', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: { items: [], total: 0 } });
  });

  it('渲染新增凭证按钮', async () => {
    render(<VoucherList />);
    expect(await screen.findByText('新增凭证')).toBeInTheDocument();
  });

  it('渲染凭证列表条数', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        items: [
          {
            id: 1,
            period: '2026-01',
            voucherType: '记',
            voucherNo: 1,
            date: '2026-01-15',
            status: 'posted',
            entries: [{ summary: '测试摘要XYZ', direction: 'debit', amount: '100.00' }],
          },
        ],
        total: 1,
      },
    });
    render(<VoucherList />);
    expect(await screen.findByText(/共 1 条/)).toBeInTheDocument();
  });
});
