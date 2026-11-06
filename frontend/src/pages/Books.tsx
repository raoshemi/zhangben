import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
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
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { useBooks, type Book } from '../hooks/useBooks';
import { useRole } from '../hooks/useRole';
import { STANDARD_LABEL, errorMessage } from '../lib/format';

const { Text } = Typography;

interface BookFormValues {
  name: string;
  accountingStandard: string;
  baseCurrency?: string;
  range: [Dayjs, Dayjs];
}

export default function Books() {
  const { books, loading, error, reload } = useBooks();
  const { isReadOnly } = useRole();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<BookFormValues>();

  const create = async () => {
    let values: BookFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验信息由 Form 就地提示
    }
    setSubmitting(true);
    try {
      await api.post('/books', {
        name: values.name,
        accountingStandard: values.accountingStandard,
        baseCurrency: values.baseCurrency || 'CNY',
        startDate: values.range[0].startOf('month').format('YYYY-MM-DD'),
        endDate: values.range[1].endOf('month').format('YYYY-MM-DD'),
      });
      message.success('账套已创建，下一步：初始化会计科目');
      setOpen(false);
      form.resetFields();
      reload();
    } catch (e) {
      message.error(errorMessage(e, '创建账套失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<Book> = useMemo(
    () => [
      {
        title: '账套名称',
        dataIndex: 'name',
        render: (v: string, r) => (
          <Space size={6}>
            <span style={{ fontWeight: 600 }}>{v}</span>
            {r.isActive === false && <Tag color="red">已停用</Tag>}
          </Space>
        ),
      },
      {
        title: '会计准则',
        dataIndex: 'accountingStandard',
        width: 160,
        render: (v: string) =>
          v === 'enterprise' ? (
            <Tag color="blue">{STANDARD_LABEL.enterprise}</Tag>
          ) : (
            <Tag color="green">{STANDARD_LABEL.small}</Tag>
          ),
      },
      { title: '本位币', dataIndex: 'baseCurrency', width: 90 },
      {
        title: '启用期间',
        key: 'range',
        width: 220,
        render: (_, r) =>
          r.startDate && r.endDate
            ? `${dayjs(r.startDate).format('YYYY-MM-DD')} ~ ${dayjs(r.endDate).format(
                'YYYY-MM-DD',
              )}`
            : <Text type="secondary">—</Text>,
      },
    ],
    [],
  );

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="账套管理"
        description="账套是一切账簿、凭证、报表的隔离边界；新建后系统按所选准则初始化科目表"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
              刷新
            </Button>
            <Tooltip title={isReadOnly ? '仅系统管理员可新建账套' : undefined}>
              <span>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={isReadOnly}
                  onClick={() => setOpen(true)}
                >
                  新建账套
                </Button>
              </span>
            </Tooltip>
          </Space>
        }
      />

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={error}
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
          dataSource={books}
          columns={columns}
          loading={loading}
          size="middle"
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="还没有账套。新建账套后即可开始录入凭证。"
              />
            ),
          }}
        />
      </Card>

      <Modal
        title="新建账套"
        open={open}
        onOk={() => void create()}
        confirmLoading={submitting}
        onCancel={() => setOpen(false)}
        okText="创建账套"
        cancelText="取消"
        destroyOnHidden
        maskClosable={false}
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="name"
            label="账套名称"
            rules={[
              { required: true, message: '请填写账套名称' },
              { max: 50, message: '名称不超过 50 个字符' },
            ]}
          >
            <Input placeholder="如 某某贸易有限公司 2026 年度账" autoFocus />
          </Form.Item>
          <Form.Item
            name="accountingStandard"
            label="会计准则"
            initialValue="enterprise"
            tooltip="决定系统初始化的科目表与报表格式，创建后不可更改"
            rules={[{ required: true, message: '请选择会计准则' }]}
          >
            <Select
              options={[
                { value: 'enterprise', label: '企业会计准则' },
                { value: 'small', label: '小企业会计准则' },
              ]}
            />
          </Form.Item>
          <Form.Item name="baseCurrency" label="本位币" initialValue="CNY">
            <Input placeholder="CNY" maxLength={10} />
          </Form.Item>
          <Form.Item
            name="range"
            label="会计期间"
            tooltip="按自然月自动生成期间；按月的起止日保存"
            rules={[{ required: true, message: '请选择会计期间起止月份' }]}
          >
            <DatePicker.RangePicker
              picker="month"
              style={{ width: '100%' }}
              disabledDate={(d) => d.isBefore(dayjs('1900-01-01'), 'month')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
