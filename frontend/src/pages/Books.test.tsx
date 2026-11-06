import { render, screen } from '@testing-library/react';
import Books from './Books';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('Books 账套管理', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({
      data: [{ id: 1, name: '默认账套', accountingStandard: 'enterprise' }],
    });
  });

  it('渲染新建账套按钮', async () => {
    render(<Books />);
    expect(screen.getByText('新建账套')).toBeInTheDocument();
  });
});
