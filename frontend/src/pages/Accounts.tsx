import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react';
import { Alert, Button, Card, Empty, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';
import BookSelect from '../components/BookSelect';
import BooksEmptyHint from '../components/BooksEmptyHint';
import PageHeader from '../components/PageHeader';
import { useAccounts, type Account } from '../hooks/useAccounts';
import { useBooks } from '../hooks/useBooks';
import { ACCOUNT_CATEGORY_COLOR, ACCOUNT_CATEGORY_LABEL, AUX_TYPE_LABEL } from '../lib/format';

const { Text } = Typography;

interface AccountNode extends Account {
  children?: AccountNode[];
}

const categoryOptions = Object.entries(ACCOUNT_CATEGORY_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export default function Accounts() {
  const { books, loading: booksLoading } = useBooks();
  const [bookId, setBookId] = useState<number>();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string>();
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);

  const { accounts, loading, error, reload } = useAccounts(bookId);

  useEffect(() => {
    if (bookId == null && books.length) setBookId(books[0].id);
  }, [books, bookId]);

  // 默认展开所有汇总科目，让「一级 → 明细」的层级关系一眼可见
  useEffect(() => {
    setExpandedKeys(accounts.filter((a) => !a.isLeaf).map((a) => a.id));
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return accounts.filter((a) => {
      const hitKeyword =
        !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
      const hitCategory = !category || a.category === category;
      return hitKeyword && hitCategory;
    });
  }, [accounts, keyword, category]);

  const treeData = useMemo<AccountNode[]>(() => {
    // 搜索/筛选时退化为平铺列表：避免父级被过滤掉导致子级"消失"
    if (keyword.trim() || category) return filtered.map((a) => ({ ...a, children: undefined }));
    const map = new Map<number, AccountNode>();
    accounts.forEach((a) => map.set(a.id, { ...a, children: undefined }));
    const roots: AccountNode[] = [];
    accounts.forEach((a) => {
      const node = map.get(a.id)!;
      const parent = a.parentId != null ? map.get(a.parentId) : undefined;
      if (parent) {
        parent.children = parent.children ? [...parent.children, node] : [node];
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [accounts, filtered, keyword, category]);

  const stats = useMemo(() => {
    const leaves = accounts.filter((a) => a.isLeaf);
    const withAux = accounts.filter((a) => a.auxFlags.length > 0);
    return { total: accounts.length, leaves: leaves.length, withAux: withAux.length };
  }, [accounts]);

  const columns: ColumnsType<AccountNode> = [
    {
      title: '科目编码',
      dataIndex: 'code',
      width: 160,
      render: (v: string) => (
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v}</span>
      ),
    },
    {
      title: '科目名称',
      dataIndex: 'name',
      render: (v: string, r) => (
        <Space size={6}>
          <span style={{ fontWeight: r.isLeaf ? 400 : 600 }}>{v}</span>
          {!r.isLeaf && <Tag style={{ marginInlineEnd: 0 }}>汇总</Tag>}
        </Space>
      ),
    },
    {
      title: '类别',
      dataIndex: 'category',
      width: 90,
      render: (v: string) => (
        <Tag color={ACCOUNT_CATEGORY_COLOR[v]}>{ACCOUNT_CATEGORY_LABEL[v] ?? v}</Tag>
      ),
    },
    {
      title: '余额方向',
      dataIndex: 'balanceSide',
      width: 90,
      render: (v: string) => (v === 'debit' ? '借' : '贷'),
    },
    {
      title: '辅助核算',
      dataIndex: 'auxFlags',
      width: 220,
      render: (flags: string[]) =>
        flags.length ? (
          <Space size={4} wrap>
            {flags.map((f) => (
              <Tag key={f} color="blue" style={{ marginInlineEnd: 0 }}>
                {AUX_TYPE_LABEL[f] ?? (f === 'cashflow' ? '现金流量' : f)}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '级次',
      dataIndex: 'level',
      width: 70,
      align: 'center',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="会计科目"
        description={
          accounts.length
            ? `共 ${stats.total} 个科目（明细 ${stats.leaves} 个，启用辅助核算 ${stats.withAux} 个）· 仅明细科目可用于凭证分录`
            : '科目表由账套初始化生成，按级次树形展示'
        }
      />

      <BooksEmptyHint books={books} loading={booksLoading} />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <BookSelect
            books={books}
            value={bookId}
            onChange={setBookId}
            loading={booksLoading}
            style={{ width: 260 }}
          />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索科目编码 / 名称"
            style={{ width: 240 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            allowClear
            placeholder="科目类别"
            style={{ width: 140 }}
            value={category}
            onChange={setCategory}
            options={categoryOptions}
          />
          {(keyword || category) && (
            <Button
              onClick={() => {
                setKeyword('');
                setCategory(undefined);
              }}
            >
              清空筛选
            </Button>
          )}
        </Space>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={`科目表加载失败：${error}`}
          action={
            <Button size="small" onClick={reload}>
              重试
            </Button>
          }
        />
      )}

      <Card size="small">
        <Table
          rowKey="id"
          dataSource={treeData}
          columns={columns}
          loading={loading}
          pagination={false}
          size="small"
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: (keys) => setExpandedKeys([...keys]),
          }}
          scroll={{ y: 'calc(100vh - 320px)' }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  books.length === 0
                    ? '尚未创建账套，创建账套后会自动带出标准科目表'
                    : keyword || category
                      ? '没有匹配的科目，试试清空筛选条件'
                      : '该账套暂无科目'
                }
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}
