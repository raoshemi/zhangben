import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Space,
  Tag,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/client';

interface Book {
  id: number;
  name: string;
  accountingStandard: string;
  baseCurrency: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export default function Books() {
  const [books, setBooks] = useState<Book[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = () => api.get('/books').then(({ data }) => setBooks(data));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await api.post('/books', {
        name: values.name,
        accountingStandard: values.accountingStandard,
        startDate: values.range[0].format('YYYY-MM-DD'),
        endDate: values.range[1].format('YYYY-MM-DD'),
      });
      message.success('创建成功');
      setOpen(false);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '会计准则',
      dataIndex: 'accountingStandard',
      render: (v: string) =>
        v === 'enterprise' ? (
          <Tag color="blue">企业会计准则</Tag>
        ) : (
          <Tag color="green">小企业会计准则</Tag>
        ),
    },
    { title: '本位币', dataIndex: 'baseCurrency' },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新建账套
        </Button>
      </Space>
      <Table rowKey="id" dataSource={books} columns={columns} />
      <Modal
        title="新建账套"
        open={open}
        onOk={create}
        confirmLoading={submitting}
        onCancel={() => setOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="账套名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="accountingStandard"
            label="会计准则"
            initialValue="enterprise"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'enterprise', label: '企业会计准则' },
                { value: 'small', label: '小企业会计准则' },
              ]}
            />
          </Form.Item>
          <Form.Item name="range" label="会计期间" rules={[{ required: true }]}>
            <DatePicker.RangePicker />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
