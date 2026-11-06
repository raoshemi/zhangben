import { useEffect, useState } from 'react';
import {
  Table,
  Select,
  Button,
  Modal,
  Form,
  Input,
  message,
  Space,
  Tag,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../api/client';

const auxTypeLabel: Record<string, string> = {
  customer: '客户',
  supplier: '供应商',
  department: '部门',
  employee: '职员',
  project: '项目',
};

export default function Auxiliary() {
  const [books, setBooks] = useState<{ id: number; name: string }[]>([]);
  const [bookId, setBookId] = useState<number>();
  const [auxType, setAuxType] = useState<string>();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    api.get('/books').then(({ data }) => {
      setBooks(data);
      if (data.length) setBookId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!bookId) return;
    api
      .get('/auxiliary', { params: { bookId, auxType } })
      .then(({ data }) => setItems(data));
  }, [bookId, auxType]);

  const create = async () => {
    const values = await form.validateFields();
    await api.post('/auxiliary', { bookId, ...values });
    message.success('创建成功');
    setOpen(false);
    form.resetFields();
    api
      .get('/auxiliary', { params: { bookId, auxType } })
      .then(({ data }) => setItems(data));
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'auxType',
      width: 120,
      render: (v: string) => <Tag>{auxTypeLabel[v] ?? v}</Tag>,
    },
    { title: '编码', dataIndex: 'code', width: 160 },
    { title: '名称', dataIndex: 'name' },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 240 }}
          placeholder="选择账套"
          value={bookId}
          onChange={setBookId}
          options={books.map((b) => ({ value: b.id, label: b.name }))}
        />
        <Select
          style={{ width: 160 }}
          placeholder="类型"
          allowClear
          value={auxType}
          onChange={setAuxType}
          options={Object.entries(auxTypeLabel).map(([v, l]) => ({ value: v, label: l }))}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新增
        </Button>
      </Space>
      <Table rowKey="id" dataSource={items} columns={columns} size="small" />
      <Modal title="新增辅助核算" open={open} onOk={create} onCancel={() => setOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="auxType" label="类型" rules={[{ required: true }]}>
            <Select
              options={Object.entries(auxTypeLabel).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
            />
          </Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
