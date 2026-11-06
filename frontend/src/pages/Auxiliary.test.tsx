import { render, screen } from '@testing-library/react';
import Auxiliary from './Auxiliary';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('Auxiliary 辅助核算', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('渲染新增按钮', async () => {
    render(<Auxiliary />);
    expect(await screen.findByText('新增')).toBeInTheDocument();
  });
});
