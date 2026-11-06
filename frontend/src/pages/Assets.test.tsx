import { render, screen } from '@testing-library/react';
import Assets from './Assets';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('Assets 固定资产', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('渲染固定资产标题与新增按钮', async () => {
    render(<Assets />);
    expect(await screen.findByText('固定资产')).toBeInTheDocument();
    expect(await screen.findByText('新增固定资产')).toBeInTheDocument();
  });
});
