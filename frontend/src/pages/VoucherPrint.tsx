import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';

interface Entry {
  id: number;
  summary: string;
  accountId: number;
  direction: 'debit' | 'credit';
  amount: string;
}
interface Voucher {
  id: number;
  bookId: number;
  period: string;
  date: string;
  voucherType: string;
  voucherNo: number;
  attachmentCount: number;
  status: string;
  entries: Entry[];
}

export default function VoucherPrint() {
  const { id } = useParams();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [accounts, setAccounts] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!id) return;
    api.get(`/vouchers/${id}`).then(async ({ data }) => {
      setVoucher(data);
      const acctRes = await api.get('/accounts', { params: { bookId: data.bookId } });
      const map: Record<number, string> = {};
      for (const a of acctRes.data) map[a.id] = `${a.code} ${a.name}`;
      setAccounts(map);
    });
  }, [id]);

  if (!voucher) return <div style={{ padding: 20 }}>加载中...</div>;

  const debitTotal = voucher.entries
    .filter((e) => e.direction === 'debit')
    .reduce((s, e) => s + Number(e.amount), 0);
  const creditTotal = voucher.entries
    .filter((e) => e.direction === 'credit')
    .reduce((s, e) => s + Number(e.amount), 0);

  const rows = Math.max(voucher.entries.length, 8);
  const fmt = (v: string | number) => Number(v).toFixed(2);

  return (
    <div className="print-page">
      <style>{`
        .print-page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 12mm; box-sizing: border-box; font-family: "SimSun","Songti SC",serif; color: #000; background: #fff; }
        .print-page .title { text-align: center; font-size: 18pt; letter-spacing: 10px; margin: 0 0 6mm; font-weight: bold; }
        .print-page .meta { display: flex; justify-content: space-between; font-size: 10.5pt; margin-bottom: 2mm; }
        .print-page table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .print-page th, .print-page td { border: 1px solid #000; padding: 2mm 2mm; font-size: 10.5pt; height: 8mm; vertical-align: middle; }
        .print-page th { font-weight: normal; text-align: center; }
        .print-page .num { text-align: right; font-family: "Courier New", monospace; }
        .print-page .center { text-align: center; }
        .print-page .sign { display: flex; justify-content: space-between; margin-top: 5mm; font-size: 10.5pt; }
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 10mm; }
          body { margin: 0; }
        }
      `}</style>
      <div className="no-print" style={{ textAlign: 'center', marginBottom: 12 }}>
        <button onClick={() => window.print()} style={{ padding: '6px 24px', cursor: 'pointer' }}>
          打印
        </button>
        <span style={{ marginLeft: 12, color: '#888', fontSize: 12 }}>（打印预览，A4 纵向）</span>
      </div>
      <div className="title">记 账 凭 证</div>
      <div className="meta">
        <span>日期：{String(voucher.date).slice(0, 10)}</span>
        <span>凭证字号：{voucher.voucherType}-{voucher.voucherNo}</span>
        <span>附件：{voucher.attachmentCount} 张</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: '26%' }}>摘要</th>
            <th style={{ width: '34%' }}>会计科目</th>
            <th style={{ width: '20%' }}>借方金额</th>
            <th style={{ width: '20%' }}>贷方金额</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => {
            const e = voucher.entries[i];
            return (
              <tr key={i}>
                <td>{e?.summary ?? ''}</td>
                <td>{e ? (accounts[e.accountId] ?? '') : ''}</td>
                <td className="num">{e && e.direction === 'debit' ? fmt(e.amount) : ''}</td>
                <td className="num">{e && e.direction === 'credit' ? fmt(e.amount) : ''}</td>
              </tr>
            );
          })}
          <tr>
            <td className="center">合计</td>
            <td></td>
            <td className="num">{debitTotal.toFixed(2)}</td>
            <td className="num">{creditTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <div className="sign">
        <span>制单人：____________</span>
        <span>审核人：____________</span>
        <span>记账人：____________</span>
        <span>出纳：____________</span>
      </div>
    </div>
  );
}
