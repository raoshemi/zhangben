import { render, screen } from '@testing-library/react';
import CashFlow from './CashFlow';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('CashFlow 现金流量', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('渲染新增按钮', async () => {
    render(<CashFlow />);
    expect(await screen.findByText('新增')).toBeInTheDocument();
  });
});
