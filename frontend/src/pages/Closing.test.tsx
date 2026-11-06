import { render, screen } from '@testing-library/react';
import Closing from './Closing';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('Closing 期末处理', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: { rows: [] } });
  });

  it('渲染期末处理标题与期末流程说明', async () => {
    render(<Closing />);
    expect(await screen.findByText('期末处理')).toBeInTheDocument();
    expect(await screen.findByText(/期末流程/)).toBeInTheDocument();
  });
});
