import { render, screen } from '@testing-library/react';
import VoucherEdit from './VoucherEdit';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('VoucherEdit 凭证录入', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('渲染凭证录入标题、添加分录按钮与借贷合计', async () => {
    render(<VoucherEdit bookId={1} />);
    expect(screen.getByText('凭证录入')).toBeInTheDocument();
    expect(screen.getByText('添加分录')).toBeInTheDocument();
    expect(screen.getByText(/借方合计/)).toBeInTheDocument();
    expect(screen.getByText(/贷方合计/)).toBeInTheDocument();
  });
});
