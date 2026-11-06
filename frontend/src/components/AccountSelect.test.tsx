import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountSelect from './AccountSelect';
import type { Account } from '../hooks/useAccounts';

const accounts: Account[] = [
  {
    id: 1,
    code: '1001',
    name: '库存现金',
    category: 'asset',
    balanceSide: 'debit',
    level: 1,
    isLeaf: true,
    parentId: null,
    auxFlags: ['cashflow'],
  },
  {
    id: 2,
    code: '100101',
    name: '人民币',
    category: 'asset',
    balanceSide: 'debit',
    level: 2,
    isLeaf: false,
    parentId: 1,
    auxFlags: [],
  },
  {
    id: 3,
    code: '2202',
    name: '应付账款',
    category: 'liability',
    balanceSide: 'credit',
    level: 1,
    isLeaf: true,
    parentId: null,
    auxFlags: ['supplier'],
  },
];

describe('AccountSelect 科目选择器', () => {
  it('输入编码前缀即可筛选，且只列出可记账的明细科目', async () => {
    const user = userEvent.setup();
    render(<AccountSelect accounts={accounts} />);

    const input = screen.getByRole('combobox');
    await user.type(input, '2202');

    expect(await screen.findByText('应付账款')).toBeInTheDocument();
    expect(screen.queryByText('库存现金')).not.toBeInTheDocument();
    // 非叶子科目不参与选择
    expect(screen.queryByText('人民币')).not.toBeInTheDocument();
  });

  it('支持按中文名称模糊搜索', async () => {
    const user = userEvent.setup();
    render(<AccountSelect accounts={accounts} />);

    await user.type(screen.getByRole('combobox'), '现金');

    expect(await screen.findByText('库存现金')).toBeInTheDocument();
    expect(screen.queryByText('应付账款')).not.toBeInTheDocument();
  });
});
