import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Cascader,
  Col,
  DatePicker,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api/client';

interface AccountNode {
  value: number;
  label: string;
  children?: AccountNode[];
}

interface CashFlowItem {
  id: number;
  code: string;
  name: string;
}

interface AuxItem {
  id: number;
  auxType: string;
  code: string;
  name: string;
}

interface EntryRow {
  key: string;
  summary: string;
  accountPath?: number[];
  direction: 'debit' | 'credit';
  amount: string;
  cashflowItemId?: number;
  auxIds: number[];
}

const AUX_TYPE_NAME: Record<string, string> = {
  customer: '客户',
  supplier: '供应商',
  department: '部门',
  employee: '职员',
  project: '项目',
};

function toArray(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.items)) return res.items;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

interface TreeNode extends AccountNode {
  id: number;
  parentId: number | null;
  children: TreeNode[];
}

function buildAccountTree(accounts: any[]): AccountNode[] {
  const nodes: TreeNode[] = accounts.map((a) => ({
    id: a.id as number,
    parentId: (a.parentId as number | null) ?? null,
    value: a.id as number,
    label: `${a.code} ${a.name}`,
    children: [],
  }));
  const map = new Map<number, TreeNode>();
  nodes.forEach((n) => map.set(n.id, n));
  const roots: TreeNode[] = [];
  nodes.forEach((n) => {
    if (n.parentId != null && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(n);
    } else {
      roots.push(n);
    }
  });
  const clean = (list: TreeNode[]): AccountNode[] =>
    list.map((n) =>
      n.children.length
        ? { value: n.value, label: n.label, children: clean(n.children) }
        : { value: n.value, label: n.label },
    );
  return clean(roots);
}

let rowSeq = 0;
function newRow(): EntryRow {
  rowSeq += 1;
  return {
    key: `row-${Date.now()}-${rowSeq}`,
    summary: '',
    direction: 'debit',
    amount: '',
    auxIds: [],
  };
}

export default function VoucherEdit({
  bookId = 1,
  onSaved,
}: {
  bookId?: number;
  onSaved?: () => void;
}) {
  const [voucherType, setVoucherType] = useState<string>('记');
  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [rows, setRows] = useState<EntryRow[]>([newRow(), newRow()]);
  const [accountTree, setAccountTree] = useState<AccountNode[]>([]);
  const [cashFlowItems, setCashFlowItems] = useState<CashFlowItem[]>([]);
  const [auxItems, setAuxItems] = useState<AuxItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/accounts', { params: { bookId } });
        setAccountTree(buildAccountTree(toArray(data)));
      } catch {
        /* 科目接口未就绪时留空 */
      }
    })();
    (async () => {
      try {
        const { data } = await api.get('/cashflow', {
          params: { bookId },
        });
        setCashFlowItems(toArray(data));
      } catch {
        /* ignore */
      }
    })();
    (async () => {
      try {
        const { data } = await api.get('/auxiliary', {
          params: { bookId },
        });
        setAuxItems(toArray(data));
      } catch {
        /* ignore */
      }
    })();
  }, [bookId]);

  const totals = useMemo(() => {
    const debit = rows
      .filter((r) => r.direction === 'debit')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const credit = rows
      .filter((r) => r.direction === 'credit')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 };
  }, [rows]);

  const updateRow = (key: string, patch: Partial<EntryRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (key: string) =>
    setRows((prev) => (prev.length > 2 ? prev.filter((r) => r.key !== key) : prev));

  const reset = () => {
    setVoucherType('记');
    setDate(dayjs());
    setAttachmentCount(0);
    setRows([newRow(), newRow()]);
  };

  const handleSave = async () => {
    if (!date) {
      message.error('请选择凭证日期');
      return;
    }
    for (const r of rows) {
      if (!r.summary.trim()) {
        message.error('分录摘要不能为空');
        return;
      }
      if (!r.accountPath || r.accountPath.length === 0) {
        message.error('请选择分录科目');
        return;
      }
      if (!r.amount || Number(r.amount) <= 0) {
        message.error('金额必须为大于 0 的数字');
        return;
      }
    }
    if (!totals.balanced) {
      message.error('借贷不平衡，请检查各分录金额');
      return;
    }

    const period = date.format('YYYY-MM');
    const payload = {
      bookId,
      period,
      date: date.format('YYYY-MM-DD'),
      voucherType,
      attachmentCount,
      entries: rows.map((r) => ({
        summary: r.summary.trim(),
        accountId: r.accountPath![r.accountPath!.length - 1],
        direction: r.direction,
        amount: r.amount,
        cashflowItemId: r.cashflowItemId,
        auxs: r.auxIds
          .map((id) => {
            const item = auxItems.find((a) => a.id === id);
            return item ? { auxType: item.auxType, auxiliaryItemId: id } : null;
          })
          .filter(Boolean),
      })),
    };

    setSaving(true);
    try {
      await api.post('/vouchers', payload);
      message.success('凭证已保存');
      reset();
      onSaved?.();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumnsType<EntryRow> = [
    {
      title: '摘要',
      dataIndex: 'summary',
      width: 220,
      render: (_, r) => (
        <Input
          value={r.summary}
          placeholder="摘要"
          onChange={(e) => updateRow(r.key, { summary: e.target.value })}
        />
      ),
    },
    {
      title: '科目',
      dataIndex: 'accountPath',
      width: 240,
      render: (_, r) => (
        <Cascader
          style={{ width: '100%' }}
          options={accountTree}
          value={r.accountPath}
          placeholder="选择明细科目"
          showSearch
          onChange={(v) => updateRow(r.key, { accountPath: v as number[] })}
        />
      ),
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 80,
      render: (_, r) => (
        <Select
          value={r.direction}
          style={{ width: '100%' }}
          onChange={(v) => updateRow(r.key, { direction: v })}
          options={[
            { value: 'debit', label: '借' },
            { value: 'credit', label: '贷' },
          ]}
        />
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 140,
      align: 'right',
      render: (_, r) => (
        <Input
          value={r.amount}
          placeholder="0.00"
          onChange={(e) => updateRow(r.key, { amount: e.target.value })}
        />
      ),
    },
    {
      title: '现金流量项目',
      dataIndex: 'cashflowItemId',
      width: 180,
      render: (_, r) => (
        <Select
          allowClear
          style={{ width: '100%' }}
          value={r.cashflowItemId}
          placeholder="现金/银行行必选"
          onChange={(v) => updateRow(r.key, { cashflowItemId: v })}
          options={cashFlowItems.map((c) => ({
            value: c.id,
            label: `${c.code} ${c.name}`,
          }))}
        />
      ),
    },
    {
      title: '辅助核算',
      dataIndex: 'auxIds',
      width: 180,
      render: (_, r) => (
        <Select
          mode="multiple"
          allowClear
          style={{ width: '100%' }}
          value={r.auxIds}
          placeholder="可选"
          onChange={(v) => updateRow(r.key, { auxIds: v })}
          options={auxItems.map((a) => ({
            value: a.id,
            label: `${a.code} ${a.name}(${AUX_TYPE_NAME[a.auxType] ?? a.auxType})`,
          }))}
        />
      ),
    },
    {
      title: '',
      key: 'op',
      width: 48,
      render: (_, r) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          disabled={rows.length <= 2}
          onClick={() => removeRow(r.key)}
        />
      ),
    },
  ];

  return (
    <Card title="凭证录入" size="small">
      <Space wrap style={{ marginBottom: 16 }}>
        <span>凭证字</span>
        <Select
          value={voucherType}
          style={{ width: 90 }}
          onChange={setVoucherType}
          options={['记', '收', '付', '转'].map((t) => ({ value: t, label: t }))}
        />
        <span>凭证号</span>
        <InputNumber value={undefined} placeholder="自动" disabled style={{ width: 100 }} />
        <span>日期</span>
        <DatePicker value={date} onChange={setDate} />
        <span>附件</span>
        <InputNumber
          min={0}
          value={attachmentCount}
          onChange={(v) => setAttachmentCount(Number(v) || 0)}
          style={{ width: 90 }}
        />
        <span>账套</span>
        <InputNumber value={bookId} disabled style={{ width: 90 }} />
      </Space>

      <Table
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1280 }}
      />

      <Row style={{ marginTop: 16 }} align="middle" gutter={16}>
        <Col>
          <Button icon={<PlusOutlined />} onClick={addRow}>
            添加分录
          </Button>
        </Col>
        <Col flex="auto" style={{ textAlign: 'right' }}>
          <Space size="large">
            <span>
              借方合计：<b>{totals.debit.toFixed(2)}</b>
            </span>
            <span>
              贷方合计：<b>{totals.credit.toFixed(2)}</b>
            </span>
            <span>
              {totals.balanced ? (
                <Tag color="green">借贷平衡</Tag>
              ) : (
                <Tag color="red">借贷不平衡</Tag>
              )}
            </span>
          </Space>
        </Col>
      </Row>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Space>
          <Button onClick={reset}>重置</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>
            保存凭证
          </Button>
        </Space>
      </div>
    </Card>
  );
}
