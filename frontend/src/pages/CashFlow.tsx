import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../api/client';
import BookSelect from '../components/BookSelect';
import BooksEmptyHint from '../components/BooksEmptyHint';
import PageHeader from '../components/PageHeader';
import { useBooks } from '../hooks/useBooks';
import { useRole } from '../hooks/useRole';
import { errorMessage, toArray } from '../lib/format';

const { Text } = Typography;

const categoryLabel: Record<string, string> = {
  operating: '经营活动',
  investing: '投资活动',
  financing: '筹资活动',
};

const categoryColor: Record<string, string> = {
  operating: 'blue',
  investing: 'purple',
  financing: 'orange',
};

interface CashFlowItem {
  id: number;
  bookId: number;
  code: string;
  name: string;
  category: string;
}

const categoryOptions = Object.entries(categoryLabel).map(([value, label]) => ({
  value,
  label,
}));

export default function CashFlow() {
  const { books, loading: booksLoading } = useBooks();
  const { isReadOnly } = useRole();

  const [bookId, setBookId] = useState<number>();
  const [category, setCategory] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<CashFlowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (bookId == null && books.length) setBookId(books[0].id);
  }, [books, bookId]);

  const load = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/cashflow', { params: { bookId } });
      setItems(toArray(data) as CashFlowItem[]);
    } catch (e) {
      setItems([]);
      setError(errorMessage(e, '现金流量项目加载失败'));
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return items.filter((i) => {
      const hitCategory = !category || i.category === category;
      const hitKeyword =
        !q || i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q);
      return hitCategory && hitKeyword;
    });
  }, [items, category, keyword]);

  const create = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await api.post('/cashflow', { bookId, ...values });
      message.success('现金流量项目已创建');
      setOpen(false);
      form.resetFields();
      void load();
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(errorMessage(e, '创建失败'));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '编码',
      dataIndex: 'code',
      width: 120,
      render: (v: string) => (
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v}</span>
      ),
    },
    { title: '项目名称', dataIndex: 'name' },
    {
      title: '类别',
      dataIndex: 'category',
      width: 120,
      render: (v: string) => <Tag color={categoryColor[v]}>{categoryLabel[v] ?? v}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="现金流量项目"
        description="现金流量表取数口径：现金/银行科目分录必须挂到这里的某个项目上"
        extra={
          <Tooltip title={isReadOnly ? '仅系统管理员可新增' : undefined}>
            <span>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={isReadOnly}
                onClick={() => setOpen(true)}
              >
                新增
              </Button>
            </span>
          </Tooltip>
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
            style={{ width: 240 }}
          />
          <Select
            allowClear
            placeholder="活动类别（全部）"
            style={{ width: 170 }}
            value={category}
            onChange={setCategory}
            options={categoryOptions}
          />
          <Input
            allowClear
            placeholder="搜索编码 / 名称"
            style={{ width: 200 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Text type="secondary">共 {filtered.length} 项</Text>
        </Space>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={error}
          action={
            <Button size="small" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      )}

      <Card size="small">
        <Table
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          size="small"
          loading={loading}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  items.length === 0
                    ? '该账套还没有现金流量项目，录入现金/银行分录前需先建立'
                    : '没有匹配的项目，试试清空筛选条件'
                }
              />
            ),
          }}
        />
      </Card>

      <Modal
        title="新增现金流量项目"
        open={open}
        onOk={() => void create()}
        confirmLoading={saving}
        onCancel={() => setOpen(false)}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="code"
            label="编码"
            rules={[
              { required: true, message: '请填写编码' },
              { max: 20, message: '编码不超过 20 个字符' },
            ]}
          >
            <Input placeholder="如 101" />
          </Form.Item>
          <Form.Item
            name="name"
            label="项目名称"
            rules={[
              { required: true, message: '请填写项目名称' },
              { max: 100, message: '名称不超过 100 个字符' },
            ]}
          >
            <Input placeholder="如 销售商品、提供劳务收到的现金" />
          </Form.Item>
          <Form.Item
            name="category"
            label="活动类别"
            rules={[{ required: true, message: '请选择活动类别' }]}
          >
            <Select options={categoryOptions} placeholder="选择类别" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
