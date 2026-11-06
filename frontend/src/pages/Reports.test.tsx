import { render, screen } from '@testing-library/react';
import Reports from './Reports';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('Reports 财务报表', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('渲染三张报表 Tab', async () => {
    render(<Reports />);
    expect(screen.getByText('资产负债表')).toBeInTheDocument();
    expect(screen.getByText('利润表')).toBeInTheDocument();
    expect(screen.getByText('现金流量表')).toBeInTheDocument();
  });
});
