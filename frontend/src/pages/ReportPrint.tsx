import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { fmtMoney } from '../lib/format';

interface ReportRow {
  label: string;
  value: string;
  type: 'section' | 'item' | 'subtotal' | 'total';
}
interface Section {
  lines: ReportRow[];
  total: string;
}
interface BalanceData {
  period: string;
  standard: string;
  assets: Section;
  liabilities: Section;
  equity: Section;
  totalAssets: string;
  totalLiabilitiesAndEquity: string;
  balanced: boolean;
  difference: string;
}
interface IncomeData {
  period: string;
  rows: ReportRow[];
  netProfit: string;
}
interface CashFlowData {
  period: string;
  operating: Section;
  investing: Section;
  financing: Section;
  netIncrease: string;
  beginningCash: string;
  endingCash: string;
}

interface PrintLine extends ReportRow {
  no?: number;
}

const fmt = (v: string) => (v === '' ? '' : fmtMoney(v));
const periodTitle = (p: string) => (p ? p.replace('-', ' 年 ') + ' 月' : '');

/** 资产侧：插「流动资产：/非流动资产：」分段 + 资产总计 */
function buildAssetRows(sec: Section, totalAssets: string): PrintLine[] {
  const rows: PrintLine[] = [{ label: '流动资产：', value: '', type: 'section' }];
  for (const l of sec.lines) {
    rows.push(l);
    if (l.label === '流动资产合计') {
      rows.push({ label: '非流动资产：', value: '', type: 'section' });
    }
  }
  rows.push({ label: '资产总计', value: totalAssets, type: 'total' });
  return rows;
}

/** 右栏：负债（流动/非流动分段+负债合计）+ 所有者权益（含总计） */
function buildRightRows(data: BalanceData): PrintLine[] {
  const rows: PrintLine[] = [{ label: '流动负债：', value: '', type: 'section' }];
  for (const l of data.liabilities.lines) {
    rows.push(l);
    if (l.label === '流动负债合计') {
      rows.push({ label: '非流动负债：', value: '', type: 'section' });
    }
  }
  rows.push({ label: '负债合计', value: data.liabilities.total, type: 'total' });
  rows.push({ label: '所有者权益：', value: '', type: 'section' });
  for (const l of data.equity.lines) rows.push(l);
  rows.push({
    label: '负债和所有者权益总计',
    value: data.totalLiabilitiesAndEquity,
    type: 'total',
  });
  return rows;
}

export default function ReportPrint() {
  const [params] = useSearchParams();
  const bookId = params.get('bookId') ?? '1';
  const period = params.get('period') ?? '';
  const type = params.get('type') ?? 'balance';
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [income, setIncome] = useState<IncomeData | null>(null);
  const [cashflow, setCashflow] = useState<CashFlowData | null>(null);

  useEffect(() => {
    const q = { params: { bookId, period } };
    if (type === 'balance') {
      api.get('/reports/balance-sheet', q).then(({ data }) => setBalance(data));
    } else if (type === 'income') {
      api.get('/reports/income-statement', q).then(({ data }) => setIncome(data));
    } else {
      api.get('/reports/cash-flow', q).then(({ data }) => setCashflow(data));
    }
  }, [bookId, period, type]);

  const toolbar = (
    <div className="no-print" style={{ textAlign: 'center', padding: '10px 0' }}>
      <button
        onClick={() => window.print()}
        style={{ padding: '6px 24px', cursor: 'pointer' }}
      >
        打印
      </button>
      <span style={{ marginLeft: 12, color: '#888', fontSize: 12 }}>（A4 纵向）</span>
    </div>
  );

  if (type === 'balance') {
    if (!balance) return <div style={{ padding: 20 }}>加载中...</div>;
    const left = buildAssetRows(balance.assets, balance.totalAssets);
    const right = buildRightRows(balance);
    let ln = 0;
    let rn = 42;
    left.forEach((r) => {
      if (r.type !== 'section') r.no = ++ln;
    });
    right.forEach((r) => {
      if (r.type !== 'section') r.no = ++rn;
    });
    const n = Math.max(left.length, right.length);
    return (
      <div className="sheet report">
        {toolbar}
        <div className="doc-title report-title">资 产 负 债 表</div>
        <div className="meta">
          <span>编制单位：</span>
          <span>{periodTitle(period)}</span>
          <span>单位：元</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '34mm' }}>资产</th>
              <th style={{ width: '8mm' }}>行次</th>
              <th style={{ width: '28mm' }}>期末余额</th>
              <th style={{ width: '34mm' }}>负债和所有者权益</th>
              <th style={{ width: '8mm' }}>行次</th>
              <th style={{ width: '28mm' }}>期末余额</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: n }).map((_, i) => {
              const l = left[i];
              const r = right[i];
              return (
                <tr
                  key={i}
                  className={
                    l?.type === 'subtotal' || l?.type === 'total' || l?.type === 'section'
                      ? 'section-row'
                      : undefined
                  }
                >
                  <td className={l?.type === 'section' ? 'bold' : undefined}>
                    {l?.label ?? ''}
                  </td>
                  <td className="center">{l?.no ?? ''}</td>
                  <td className="num">{l ? fmt(l.value) : ''}</td>
                  <td className={r?.type === 'section' ? 'bold' : undefined}>
                    {r?.label ?? ''}
                  </td>
                  <td className="center">{r?.no ?? ''}</td>
                  <td className="num">{r ? fmt(r.value) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!balance.balanced && (
          <div className="page-footer" style={{ color: '#c00' }}>
            差额：{fmtMoney(balance.difference)} 元（资产 ≠ 负债和所有者权益，不平衡）
          </div>
        )}
        <div className="page-footer">第 1 页 共 1 页</div>
      </div>
    );
  }

  if (type === 'income') {
    if (!income) return <div style={{ padding: 20 }}>加载中...</div>;
    const rows = income.rows.map((r, i) => ({ ...r, no: i + 1 }));
    return (
      <div className="sheet report">
        {toolbar}
        <div className="doc-title report-title">利 润 表</div>
        <div className="meta">
          <span>编制单位：</span>
          <span>{periodTitle(period)}</span>
          <span>单位：元</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '120mm' }}>项目</th>
              <th style={{ width: '10mm' }}>行次</th>
              <th style={{ width: '60mm' }}>本期金额</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={r.type === 'subtotal' || r.type === 'total' ? 'section-row' : undefined}>
                <td className={r.type === 'subtotal' || r.type === 'total' ? 'bold' : undefined}>
                  {r.label}
                </td>
                <td className="center">{r.no}</td>
                <td className="num">{fmt(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="page-footer">第 1 页 共 1 页</div>
      </div>
    );
  }

  if (!cashflow) return <div style={{ padding: 20 }}>加载中...</div>;
  const groups: { title: string; sec: Section }[] = [
    { title: '一、经营活动产生的现金流量', sec: cashflow.operating },
    { title: '二、投资活动产生的现金流量', sec: cashflow.investing },
    { title: '三、筹资活动产生的现金流量', sec: cashflow.financing },
  ];
  let no = 0;
  return (
    <div className="sheet report">
      {toolbar}
      <div className="doc-title report-title">现 金 流 量 表</div>
      <div className="meta">
        <span>编制单位：</span>
        <span>{periodTitle(period)}</span>
        <span>单位：元</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: '120mm' }}>项目</th>
            <th style={{ width: '10mm' }}>行次</th>
            <th style={{ width: '60mm' }}>本期金额</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <FragmentGroup key={g.title} group={g} nextNo={() => ++no} />
          ))}
          <tr>
            <td className="bold">现金及现金等价物净增加额</td>
            <td className="center">{++no}</td>
            <td className="num bold">{fmt(cashflow.netIncrease)}</td>
          </tr>
          <tr>
            <td>期初现金余额</td>
            <td className="center">{++no}</td>
            <td className="num">{fmt(cashflow.beginningCash)}</td>
          </tr>
          <tr className="section-row">
            <td className="bold">期末现金余额</td>
            <td className="center">{++no}</td>
            <td className="num bold">{fmt(cashflow.endingCash)}</td>
          </tr>
        </tbody>
      </table>
      <div className="page-footer">第 1 页 共 1 页</div>
    </div>
  );
}

function FragmentGroup({
  group,
  nextNo,
}: {
  group: { title: string; sec: Section };
  nextNo: () => number;
}) {
  return (
    <>
      <tr className="section-row">
        <td className="bold">{group.title}</td>
        <td className="center"></td>
        <td className="num"></td>
      </tr>
      {group.sec.lines.map((r, i) => (
        <tr key={i}>
          <td>{r.label}</td>
          <td className="center">{nextNo()}</td>
          <td className="num">{fmt(r.value)}</td>
        </tr>
      ))}
      <tr className="section-row">
        <td className="bold">小计</td>
        <td className="center">{nextNo()}</td>
        <td className="num bold">{fmt(group.sec.total)}</td>
      </tr>
    </>
  );
}
