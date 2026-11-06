import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
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
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api/client';
import { useRole } from '../hooks/useRole';
import { useBook } from '../context/BookContext';

const { Title } = Typography;

interface Book {
  id: number;
  name: string;
  accountingStandard: string;
}

interface AccountOption {
  id: number;
  code: string;
  name: string;
}

interface Asset {
  id: number;
  bookId: number;
  code: string;
  name: string;
  category?: string | null;
  originalValue: string;
  residualRate: string;
  usefulLife: number;
  depreciationMethod: string;
  startDate: string;
  depreciationAccountId: number;
  depreciationAccount?: { id: number; code: string; name: string };
  accumulatedDepreciationAccountId: number;
  accumulatedDepreciationAccount?: { id: number; code: string; name: string };
  isActive: boolean;
  accumulatedDepreciation: string;
  netValue: string;
  depreciationCount: number;
}

interface AssetFormValues {
  bookId?: number;
  code?: string;
  name?: string;
  category?: string;
  originalValue?: number | string;
  residualRate?: number | string;
  usefulLife?: number;
  depreciationMethod?: string;
  startDate?: Dayjs;
  depreciationAccountId?: number;
  accumulatedDepreciationAccountId?: number;
}

export default function Assets() {
  const { isReadOnly } = useRole();
  const { bookId, book } = useBook();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);

  const [depreciateOpen, setDepreciateOpen] = useState(false);
  const [depreciateAsset, setDepreciateAsset] = useState<Asset | null>(null);
  const [depreciatePeriod, setDepreciatePeriod] = useState<Dayjs | null>(dayjs());
  const [depreciating, setDepreciating] = useState(false);

  const [form] = Form.useForm<AssetFormValues>();

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = bookId ? { bookId } : {};
      const res = await api.get('/assets', { params });
      setAssets(res.data ?? []);
    } catch {
      message.error('加载固定资产列表失败');
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const loadAccounts = useCallback(async (bookId: number) => {
    try {
      const res = await api.get('/accounts', { params: { bookId } });
      const rows: AccountOption[] = (res.data ?? [])
        .filter((a: { isLeaf?: boolean }) => a.isLeaf)
        .map((a: { id: number; code: string; name: string }) => ({
          id: a.id,
          code: a.code,
          name: a.name,
        }));
      setAccountOptions(rows);
    } catch {
      setAccountOptions([]);
    }
  }, []);

  useEffect(() => {
    if (modalOpen && bookId) {
      loadAccounts(bookId);
    }
  }, [modalOpen, bookId, loadAccounts]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      depreciationMethod: 'straight_line',
      residualRate: 0.05,
      bookId: bookId,
    });
    setModalOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditing(asset);
    form.setFieldsValue({
      bookId: asset.bookId,
      code: asset.code,
      name: asset.name,
      category: asset.category ?? undefined,
      originalValue: asset.originalValue,
      residualRate: asset.residualRate,
      usefulLife: asset.usefulLife,
      depreciationMethod: asset.depreciationMethod,
      startDate: asset.startDate ? dayjs(asset.startDate) : undefined,
      depreciationAccountId: asset.depreciationAccountId,
      accumulatedDepreciationAccountId: asset.accumulatedDepreciationAccountId,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        code: values.code,
        name: values.name,
        category: values.category ?? null,
        originalValue: String(values.originalValue ?? 0),
        residualRate: String(values.residualRate ?? 0.05),
        usefulLife: values.usefulLife,
        depreciationMethod: values.depreciationMethod ?? 'straight_line',
        startDate: values.startDate
          ? values.startDate.format('YYYY-MM-DD')
          : undefined,
        depreciationAccountId: values.depreciationAccountId,
        accumulatedDepreciationAccountId: values.accumulatedDepreciationAccountId,
      };
      if (editing) {
        await api.patch(`/assets/${editing.id}`, payload);
        message.success('已保存');
      } else {
        await api.post('/assets', { ...payload, bookId });
        message.success('已新增固定资产');
      }
      setModalOpen(false);
      loadAssets();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join('；') : String(msg ?? '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const removeAsset = async (id: number) => {
    try {
      await api.delete(`/assets/${id}`);
      message.success('已删除');
      loadAssets();
    } catch {
      message.error('删除失败');
    }
  };

  const openDepreciate = (asset: Asset) => {
    setDepreciateAsset(asset);
    setDepreciatePeriod(dayjs());
    setDepreciateOpen(true);
  };

  const submitDepreciate = async () => {
    if (!depreciateAsset || !depreciatePeriod) return;
    setDepreciating(true);
    try {
      const res = await api.post(`/assets/${depreciateAsset.id}/depreciate`, null, {
        params: { period: depreciatePeriod.format('YYYY-MM') },
      });
      message.success(`已计提折旧 ${res.data?.amount ?? ''} 元`);
      setDepreciateOpen(false);
      loadAssets();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join('；') : String(msg ?? '计提折旧失败'));
    } finally {
      setDepreciating(false);
    }
  };

  const accountLabel = (a?: { id: number; code: string; name: string }) =>
    a ? `${a.code} ${a.name}` : '-';

  const columns: ColumnsType<Asset> = [
    { title: '编码', dataIndex: 'code', width: 120 },
    { title: '名称', dataIndex: 'name', width: 180 },
    { title: '类别', dataIndex: 'category', width: 100, render: (v) => v || '-' },
    {
      title: '原值',
      dataIndex: 'originalValue',
      width: 120,
      align: 'right',
      render: (v: string) => Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    { title: '残值率', dataIndex: 'residualRate', width: 90, align: 'right' },
    { title: '使用月数', dataIndex: 'usefulLife', width: 90, align: 'right' },
    { title: '开始使用日期', dataIndex: 'startDate', width: 120 },
    {
      title: '累计折旧',
      dataIndex: 'accumulatedDepreciation',
      width: 120,
      align: 'right',
      render: (v: string) => Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    {
      title: '账面净值',
      dataIndex: 'netValue',
      width: 120,
      align: 'right',
      render: (v: string) => Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    {
      title: '折旧科目',
      width: 160,
      render: (_, r) => accountLabel(r.depreciationAccount),
    },
    {
      title: '累计折旧科目',
      width: 160,
      render: (_, r) => accountLabel(r.accumulatedDepreciationAccount),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      width: 80,
      render: (v: boolean) =>
        v ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" onClick={() => openEdit(r)} disabled={isReadOnly}>
            编辑
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            onClick={() => openDepreciate(r)}
            disabled={isReadOnly}
          >
            计提折旧
          </Button>
          <Popconfirm
            title="确认删除该固定资产？"
            description="已计提折旧的资产删除后不可恢复，建议改为停用。"
            onConfirm={() => removeAsset(r.id)}
            disabled={isReadOnly}
          >
            <Button size="small" danger disabled={isReadOnly}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const accountOptionsForSelect = useMemo(
    () =>
      accountOptions.map((a) => ({
        value: a.id,
        label: `${a.code} ${a.name}`,
      })),
    [accountOptions],
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>固定资产</Title>
      {isReadOnly && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="固定资产模块仅对系统管理员开放读写，当前角色可查看但不可新增/计提/删除"
        />
      )}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>
            当前账套：{book?.name ?? '未选择'}
          </span>
          <Button icon={<ReloadOutlined />} onClick={loadAssets}>
            刷新
          </Button>
          <Tooltip title={isReadOnly ? '仅系统管理员可新增固定资产' : undefined}>
            <span>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
                disabled={isReadOnly}
              >
                新增固定资产
              </Button>
            </span>
          </Tooltip>
        </Space>
      </Card>

      <Card size="small">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={assets}
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
          scroll={{ x: 1500 }}
        />
      </Card>

      <Modal
        title={editing ? '编辑固定资产' : '新增固定资产'}
        open={modalOpen}
        onOk={submit}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="资产编码"
            rules={[{ required: true, message: '请输入资产编码' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item
            name="name"
            label="资产名称"
            rules={[{ required: true, message: '请输入资产名称' }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="category" label="类别">
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item
            name="originalValue"
            label="原值（元）"
            rules={[{ required: true, message: '请输入原值' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              stringMode
              placeholder="0.00"
            />
          </Form.Item>
          <Form.Item
            name="residualRate"
            label="残值率"
            rules={[{ required: true, message: '请输入残值率' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={1}
              step={0.0001}
              precision={4}
              stringMode
              placeholder="0.0500"
            />
          </Form.Item>
          <Form.Item
            name="usefulLife"
            label="使用月数"
            rules={[{ required: true, message: '请输入使用月数' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} precision={0} />
          </Form.Item>
          <Form.Item name="depreciationMethod" label="折旧方法">
            <Select
              options={[{ value: 'straight_line', label: '直线法（平均年限法）' }]}
            />
          </Form.Item>
          <Form.Item
            name="startDate"
            label="开始使用日期"
            rules={[{ required: true, message: '请选择开始使用日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="depreciationAccountId"
            label="折旧费科目（借方）"
            rules={[{ required: true, message: '请选择折旧费科目' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="请选择科目"
              options={accountOptionsForSelect}
            />
          </Form.Item>
          <Form.Item
            name="accumulatedDepreciationAccountId"
            label="累计折旧科目（贷方）"
            rules={[{ required: true, message: '请选择累计折旧科目' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="请选择科目"
              options={accountOptionsForSelect}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`计提折旧：${depreciateAsset?.name ?? ''}`}
        open={depreciateOpen}
        onOk={submitDepreciate}
        confirmLoading={depreciating}
        onCancel={() => setDepreciateOpen(false)}
        okText="计提"
        cancelText="取消"
        destroyOnHidden
      >
        <p style={{ marginBottom: 8 }}>
          月折旧额 = 原值 × (1 - 残值率) / 使用月数，四舍五入到分；计提后自动生成折旧凭证。
        </p>
        <Form layout="vertical">
          <Form.Item label="期间" required>
            <DatePicker
              picker="month"
              style={{ width: '100%' }}
              value={depreciatePeriod}
              onChange={setDepreciatePeriod}
              allowClear={false}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
