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
});
