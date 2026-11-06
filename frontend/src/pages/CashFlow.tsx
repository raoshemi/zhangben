import { useEffect, useState } from 'react';
import { Table, Select, Button, Modal, Form, Input, message, Space, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../api/client';

const categoryLabel: Record<string, string> = {
  operating: '经营活动',
  investing: '投资活动',
  financing: '筹资活动',
};

export default function CashFlow() {
  const [books, setBooks] = useState<{ id: number; name: string }[]>([]);
  const [bookId, setBookId] = useState<number>();
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
    api.get('/cashflow', { params: { bookId } }).then(({ data }) => setItems(data));
  }, [bookId]);

  const create = async () => {
    const values = await form.validateFields();
    await api.post('/cashflow', { bookId, ...values });
    message.success('创建成功');
    setOpen(false);
    form.resetFields();
    api.get('/cashflow', { params: { bookId } }).then(({ data }) => setItems(data));
  };

  const columns = [
    { title: '编码', dataIndex: 'code', width: 120 },
    { title: '名称', dataIndex: 'name' },
    {
      title: '类别',
      dataIndex: 'category',
      width: 120,
      render: (v: string) => <Tag>{categoryLabel[v] ?? v}</Tag>,
    },
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
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新增
        </Button>
      </Space>
      <Table rowKey="id" dataSource={items} columns={columns} size="small" />
      <Modal title="新增现金流量项目" open={open} onOk={create} onCancel={() => setOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true }]}>
            <Select
              options={Object.entries(categoryLabel).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
