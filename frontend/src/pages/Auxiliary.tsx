import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
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
import BooksEmptyHint from '../components/BooksEmptyHint';
import PageHeader from '../components/PageHeader';
import { useBook } from '../context/BookContext';
import { useRole } from '../hooks/useRole';
import { AUX_TYPE_LABEL, errorMessage, toArray } from '../lib/format';

const { Text } = Typography;

interface AuxItem {
  id: number;
  bookId: number;
  auxType: string;
  code: string;
  name: string;
}

const auxTypeOptions = Object.entries(AUX_TYPE_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export default function Auxiliary() {
  const { books, bookId, setBookId, loading: booksLoading } = useBook();
  const { isReadOnly, canManageSettings } = useRole();

  const [auxType, setAuxType] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<AuxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/auxiliary', { params: { bookId, auxType } });
      setItems(toArray(data) as AuxItem[]);
    } catch (e) {
      setItems([]);
      setError(errorMessage(e, '辅助核算项加载失败'));
    } finally {
      setLoading(false);
    }
  }, [bookId, auxType]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
    );
  }, [items, keyword]);

  const create = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await api.post('/auxiliary', { bookId, ...values });
      message.success('辅助核算项已创建');
      setOpen(false);
      form.resetFields();
      void load();
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return; // 表单校验失败，交给 Form 提示
      message.error(errorMessage(e, '创建失败'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/auxiliary/${id}`);
      message.success('已删除');
      void load();
    } catch (e) {
      message.error(errorMessage(e, '删除失败'));
    }
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'auxType',
      width: 120,
      render: (v: string) => <Tag>{AUX_TYPE_LABEL[v] ?? v}</Tag>,
    },
    {
      title: '编码',
      dataIndex: 'code',
      width: 180,
      render: (v: string) => (
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v}</span>
      ),
    },
    { title: '名称', dataIndex: 'name' },
    {
      title: '操作',
      key: 'op',
      width: 100,
      render: (_: unknown, r: AuxItem) => (
        <Tooltip title={isReadOnly ? '仅系统管理员可删除' : undefined}>
          <span>
            <Popconfirm
              title="确认删除该辅助核算项？"
              description="已被凭证引用时删除会失败，可改为停用。"
              onConfirm={() => void remove(r.id)}
              okText="删除"
              cancelText="取消"
              disabled={isReadOnly}
            >
              <Button size="small" danger disabled={isReadOnly}>
                删除
              </Button>
            </Popconfirm>
          </span>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="辅助核算"
        description="客户 / 供应商 / 部门 / 职员 / 项目等辅助核算项，录入凭证时按科目启用情况可选"
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
          
          <Select
            style={{ width: 150 }}
            placeholder="类型（全部）"
            allowClear
            value={auxType}
            onChange={setAuxType}
            options={auxTypeOptions}
          />
          <Input
            allowClear
            placeholder="搜索编码 / 名称"
            style={{ width: 200 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Text type="secondary">
            共 {filtered.length} 项
            {isReadOnly ? '（当前角色为只读，不能新增/删除）' : ''}
          </Text>
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
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  canManageSettings
                    ? '还没有辅助核算项，点击右上角「新增」建立客户/部门等档案'
                    : '当前账套还没有辅助核算项'
                }
              />
            ),
          }}
        />
      </Card>

      <Modal
        title="新增辅助核算项"
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
            name="auxType"
            label="类型"
            rules={[{ required: true, message: '请选择辅助核算类型' }]}
          >
            <Select options={auxTypeOptions} placeholder="选择类型" />
          </Form.Item>
          <Form.Item
            name="code"
            label="编码"
            rules={[
              { required: true, message: '请填写编码' },
              { max: 30, message: '编码不超过 30 个字符' },
            ]}
          >
            <Input placeholder="如 C001" />
          </Form.Item>
          <Form.Item
            name="name"
            label="名称"
            rules={[
              { required: true, message: '请填写名称' },
              { max: 100, message: '名称不超过 100 个字符' },
            ]}
          >
            <Input placeholder="如 北京某某贸易有限公司" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
