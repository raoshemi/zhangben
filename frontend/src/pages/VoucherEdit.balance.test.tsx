import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VoucherEdit from './VoucherEdit';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('VoucherEdit 金额与借贷平衡', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('金额失焦补足两位小数，并实时显示借贷差额', async () => {
    render(<VoucherEdit bookId={1} />);
    await screen.findByText('凭证录入');

    const amounts = screen.getAllByPlaceholderText('0.00');
    expect(amounts).toHaveLength(2);

    fireEvent.change(amounts[0], { target: { value: '100' } });
    fireEvent.blur(amounts[0]);

    await waitFor(() => expect(amounts[0]).toHaveValue('100.00'));
    expect(await screen.findByText(/借贷不平衡（差额 100.00）/)).toBeInTheDocument();

    fireEvent.change(amounts[1], { target: { value: '100' } });
    fireEvent.blur(amounts[1]);
    // 第二行改为贷方后借贷各 100，应提示平衡
    fireEvent.click(screen.getAllByText('贷')[1]);

    expect(await screen.findByText('借贷平衡')).toBeInTheDocument();
  });

  it('切换方向后金额归入对应合计', async () => {
    render(<VoucherEdit bookId={1} />);
    await screen.findByText('凭证录入');

    const amounts = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(amounts[0], { target: { value: '50' } });
    fireEvent.blur(amounts[0]);

    // 第一行的「贷」方向开关
    fireEvent.click(screen.getAllByText('贷')[0]);

    expect(await screen.findByText(/借贷不平衡（差额 50.00）/)).toBeInTheDocument();
  });
});
