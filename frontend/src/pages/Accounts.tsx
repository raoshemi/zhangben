import { useEffect, useState } from 'react';
import { Table, Select, Tag } from 'antd';
import api from '../api/client';

interface Account {
  id: number;
  code: string;
  name: string;
  category: string;
  balanceSide: string;
  level: number;
  isLeaf: boolean;
}

const categoryLabel: Record<string, string> = {
  asset: '资产',
  liability: '负债',
  common: '共同',
  equity: '权益',
  cost: '成本',
  pnl: '损益',
};

const categoryColor: Record<string, string> = {
  asset: 'blue',
  liability: 'orange',
  common: 'purple',
  equity: 'green',
  cost: 'magenta',
  pnl: 'red',
};

export default function Accounts() {
  const [books, setBooks] = useState<{ id: number; name: string }[]>([]);
  const [bookId, setBookId] = useState<number>();
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    api.get('/books').then(({ data }) => {
      setBooks(data);
      if (data.length) setBookId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!bookId) return;
    api.get('/accounts', { params: { bookId } }).then(({ data }) => setAccounts(data));
  }, [bookId]);

  const columns = [
    { title: '编码', dataIndex: 'code', width: 160 },
    {
      title: '名称',
      dataIndex: 'name',
      render: (v: string, r: Account) => (
        <span style={{ paddingLeft: (r.level - 1) * 20 }}>{v}</span>
      ),
    },
    {
      title: '类别',
      dataIndex: 'category',
      width: 100,
      render: (v: string) => <Tag color={categoryColor[v]}>{categoryLabel[v] ?? v}</Tag>,
    },
    {
      title: '余额方向',
      dataIndex: 'balanceSide',
      width: 90,
      render: (v: string) => (v === 'debit' ? '借' : '贷'),
    },
    { title: '级次', dataIndex: 'level', width: 70 },
  ];

  return (
    <div>
      <Select
        style={{ width: 300, marginBottom: 16 }}
        placeholder="选择账套"
        value={bookId}
        onChange={setBookId}
        options={books.map((b) => ({ value: b.id, label: b.name }))}
      />
      <Table
        rowKey="id"
        dataSource={accounts}
        columns={columns}
        pagination={false}
        size="small"
        scroll={{ y: 'calc(100vh - 260px)' }}
      />
    </div>
  );
}
