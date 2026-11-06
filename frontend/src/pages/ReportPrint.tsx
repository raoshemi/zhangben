import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';

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
  assets: Section;
  liabilities: Section;
  equity: Section;
  totalAssets: string;
  totalLiabilitiesAndEquity: string;
  balanced: boolean;
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

const printCss = `
  .print-page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 12mm; box-sizing: border-box; font-family: "SimSun","Songti SC",serif; color: #000; background: #fff; }
  .print-page .title { text-align: center; font-size: 16pt; letter-spacing: 6px; margin: 0 0 5mm; font-weight: bold; }
  .print-page .meta { display: flex; justify-content: space-between; font-size: 10.5pt; margin-bottom: 2mm; }
  .print-page table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .print-page th, .print-page td { border: 1px solid #000; padding: 1.6mm 2mm; font-size: 10.5pt; height: 7mm; }
  .print-page th { font-weight: normal; text-align: center; }
  .print-page .num { text-align: right; font-family: "Courier New", monospace; }
  .print-page .bold { font-weight: bold; }
  .print-page .section { font-weight: bold; }
  @media print {
    .no-print { display: none !important; }
    @page { size: A4; margin: 10mm; }
    body { margin: 0; }
  }
`;

function split(rows: ReportRow[]): { label: string; value: string; section?: boolean }[] {
  return rows.map((r) => ({ label: r.label, value: r.value, section: r.type === 'section' }));
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
    <div className="no-print" style={{ textAlign: 'center', marginBottom: 12 }}>
      <button onClick={() => window.print()} style={{ padding: '6px 24px', cursor: 'pointer' }}>
        打印
      </button>
    </div>
  );
  const meta = (title: string, periodText: string) => (
    <>
      <div className="title">{title}</div>
      <div className="meta">
        <span>编制单位：账本记账系统</span>
        <span>期间：{periodText}</span>
        <span>单位：元</span>
      </div>
    </>
  );

  if (type === 'balance') {
    if (!balance) return <div style={{ padding: 20 }}>加载中...</div>;
    const left = split(balance.assets.lines);
    const right = [...split(balance.liabilities.lines), ...split(balance.equity.lines)];
    // 左栏末尾追加「资产总计」，右栏末尾追加「负债和所有者权益总计」
    left.push({ label: '资产总计', value: balance.totalAssets, section: true });
    right.push({ label: '负债和所有者权益总计', value: balance.totalLiabilitiesAndEquity, section: true });
    const n = Math.max(left.length, right.length);
    return (
      <div className="print-page">
        <style>{printCss}</style>
        {toolbar}
        {meta('资 产 负 债 表', balance.period)}
        <table>
          <thead>
            <tr>
              <th style={{ width: '28%' }}>资产</th>
              <th style={{ width: '22%' }}>期末数</th>
              <th style={{ width: '28%' }}>负债和所有者权益</th>
              <th style={{ width: '22%' }}>期末数</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: n }).map((_, i) => {
              const l = left[i];
              const r = right[i];
              return (
                <tr key={i}>
                  <td className={l?.section ? 'bold' : undefined}>{l?.label ?? ''}</td>
                  <td className="num">{l ? (l.value === '' ? '' : Number(l.value).toFixed(2)) : ''}</td>
                  <td className={r?.section ? 'bold' : undefined}>{r?.label ?? ''}</td>
                  <td className="num">{r ? (r.value === '' ? '' : Number(r.value).toFixed(2)) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === 'income') {
    if (!income) return <div style={{ padding: 20 }}>加载中...</div>;
    return (
      <div className="print-page">
        <style>{printCss}</style>
        {toolbar}
        {meta('利 润 表', income.period)}
        <table>
          <thead>
            <tr>
              <th style={{ width: '70%' }}>项目</th>
              <th style={{ width: '30%' }}>本期金额</th>
            </tr>
          </thead>
          <tbody>
            {income.rows.map((r, i) => (
              <tr key={i}>
                <td className={r.type === 'section' || r.type === 'total' || r.type === 'subtotal' ? 'bold' : undefined}>{r.label}</td>
                <td className="num">{r.type === 'section' ? '' : Number(r.value).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!cashflow) return <div style={{ padding: 20 }}>加载中...</div>;
  const sections: { title: string; sec: Section }[] = [
    { title: '一、经营活动产生的现金流量', sec: cashflow.operating },
    { title: '二、投资活动产生的现金流量', sec: cashflow.investing },
    { title: '三、筹资活动产生的现金流量', sec: cashflow.financing },
  ];
  return (
    <div className="print-page">
      <style>{printCss}</style>
      {toolbar}
      {meta('现 金 流 量 表', cashflow.period)}
      <table>
        <thead>
          <tr>
            <th style={{ width: '70%' }}>项目</th>
            <th style={{ width: '30%' }}>本期金额</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <>
              <tr key={s.title}>
                <td className="section">{s.title}</td>
                <td className="num"></td>
              </tr>
              {s.sec.lines.map((r, i) => (
                <tr key={`${s.title}-${i}`}>
                  <td className={r.type === 'section' ? 'bold' : undefined}>{r.label}</td>
                  <td className="num">{r.type === 'section' ? '' : Number(r.value).toFixed(2)}</td>
                </tr>
              ))}
              <tr key={`${s.title}-total`}>
                <td className="bold">小计</td>
                <td className="num bold">{Number(s.sec.total).toFixed(2)}</td>
              </tr>
            </>
          ))}
          <tr>
            <td className="bold">现金及现金等价物净增加额</td>
            <td className="num bold">{Number(cashflow.netIncrease).toFixed(2)}</td>
          </tr>
          <tr>
            <td>期初现金余额</td>
            <td className="num">{Number(cashflow.beginningCash).toFixed(2)}</td>
          </tr>
          <tr>
            <td className="bold">期末现金余额</td>
            <td className="num bold">{Number(cashflow.endingCash).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
