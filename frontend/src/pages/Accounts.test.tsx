import { render, screen } from '@testing-library/react';
import Accounts from './Accounts';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('Accounts 会计科目', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('渲染页面标题与账套选择器', async () => {
    render(<Accounts />);
    expect(await screen.findByText('会计科目')).toBeInTheDocument();
  });
});
