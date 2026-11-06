import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
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

function Meta({ period }: { period: string }) {
  return (
    <div className="meta">
      <span>编制单位：</span>
      <span>{periodTitle(period)}</span>
      <span>单位：元</span>
    </div>
  );
}

function BalanceSheet({ data, period, page }: { data: BalanceData; period: string; page: number }) {
  const left = buildAssetRows(data.assets, data.totalAssets);
  const right = buildRightRows(data);
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
    <div className="sheet report" style={page > 1 ? { breakBefore: 'page', pageBreakBefore: 'always' } : undefined}>
      <div className="doc-title report-title">资 产 负 债 表</div>
      <Meta period={period} />
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
                <td className={l?.type === 'section' ? 'bold' : undefined}>{l?.label ?? ''}</td>
                <td className="center">{l?.no ?? ''}</td>
                <td className="num">{l ? fmt(l.value) : ''}</td>
                <td className={r?.type === 'section' ? 'bold' : undefined}>{r?.label ?? ''}</td>
                <td className="center">{r?.no ?? ''}</td>
                <td className="num">{r ? fmt(r.value) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!data.balanced && (
        <div className="page-footer" style={{ color: '#c00' }}>
          差额：{fmtMoney(data.difference)} 元（资产 ≠ 负债和所有者权益，不平衡）
        </div>
      )}
      <div className="page-footer">第 {page} 页</div>
    </div>
  );
}

function IncomeSheet({ data, period, page }: { data: IncomeData; period: string; page: number }) {
  const rows = data.rows.map((r, i) => ({ ...r, no: i + 1 }));
  return (
    <div className="sheet report" style={page > 1 ? { breakBefore: 'page', pageBreakBefore: 'always' } : undefined}>
      <div className="doc-title report-title">利 润 表</div>
      <Meta period={period} />
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
              <td className={r.type === 'subtotal' || r.type === 'total' ? 'bold' : undefined}>{r.label}</td>
              <td className="center">{r.no}</td>
              <td className="num">{fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="page-footer">第 {page} 页</div>
    </div>
  );
}

function CashFlowSheet({ data, period, page }: { data: CashFlowData; period: string; page: number }) {
  const groups: { title: string; sec: Section }[] = [
    { title: '一、经营活动产生的现金流量', sec: data.operating },
    { title: '二、投资活动产生的现金流量', sec: data.investing },
    { title: '三、筹资活动产生的现金流量', sec: data.financing },
  ];
  let no = 0;
  return (
    <div className="sheet report" style={page > 1 ? { breakBefore: 'page', pageBreakBefore: 'always' } : undefined}>
      <div className="doc-title report-title">现 金 流 量 表</div>
      <Meta period={period} />
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
            <td className="num bold">{fmt(data.netIncrease)}</td>
          </tr>
          <tr>
            <td>期初现金余额</td>
            <td className="center">{++no}</td>
            <td className="num">{fmt(data.beginningCash)}</td>
          </tr>
          <tr className="section-row">
            <td className="bold">期末现金余额</td>
            <td className="center">{++no}</td>
            <td className="num bold">{fmt(data.endingCash)}</td>
          </tr>
        </tbody>
      </table>
      <div className="page-footer">第 {page} 页</div>
    </div>
  );
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
    if (type === 'balance' || type === 'all') {
      api.get('/reports/balance-sheet', q).then(({ data }) => setBalance(data));
    }
    if (type === 'income' || type === 'all') {
      api.get('/reports/income-statement', q).then(({ data }) => setIncome(data));
    }
    if (type === 'cashflow' || type === 'all') {
      api.get('/reports/cash-flow', q).then(({ data }) => setCashflow(data));
    }
  }, [bookId, period, type]);

  const sheets: ReactNode[] = [];
  let page = 1;
  if ((type === 'balance' || type === 'all') && balance) {
    sheets.push(<BalanceSheet key="b" data={balance} period={period} page={page++} />);
  }
  if ((type === 'income' || type === 'all') && income) {
    sheets.push(<IncomeSheet key="i" data={income} period={period} page={page++} />);
  }
  if ((type === 'cashflow' || type === 'all') && cashflow) {
    sheets.push(<CashFlowSheet key="c" data={cashflow} period={period} page={page++} />);
  }

  if (!sheets.length) return <div style={{ padding: 20 }}>加载中...</div>;

  return (
    <>
      <div className="no-print" style={{ textAlign: 'center', padding: '10px 0' }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '6px 24px', cursor: 'pointer' }}
        >
          打印{sheets.length > 1 ? `（共 ${sheets.length} 张）` : ''}
        </button>
        <span style={{ marginLeft: 12, color: '#888', fontSize: 12 }}>（A4 纵向）</span>
      </div>
      {sheets}
    </>
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
