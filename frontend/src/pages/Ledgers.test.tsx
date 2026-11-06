import { render, screen } from '@testing-library/react';
import Ledgers from './Ledgers';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('Ledgers 账簿查询', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: { rows: [] } });
  });

  it('渲染账簿查询标题与账簿 Tab', async () => {
    render(<Ledgers />);
    expect(await screen.findByText('账簿查询')).toBeInTheDocument();
    expect(await screen.findByText('总账')).toBeInTheDocument();
    expect(await screen.findByText('试算平衡')).toBeInTheDocument();
  });
});
