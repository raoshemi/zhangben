import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { amountInChinese, chineseDate, fmtMoney, toCents } from '../lib/format';

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
interface Book {
  id: number;
  name: string;
}

export default function VoucherPrint() {
  const { id } = useParams();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [accounts, setAccounts] = useState<Record<number, string>>({});
  const [bookName, setBookName] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/vouchers/${id}`).then(async ({ data }) => {
      setVoucher(data);
      const [acctRes, bookRes] = await Promise.all([
        api.get('/accounts', { params: { bookId: data.bookId } }),
        api.get('/ledgers/books').catch(() => ({ data: { rows: [] } })),
      ]);
      const map: Record<number, string> = {};
      for (const a of acctRes.data) map[a.id] = `${a.code} ${a.name}`;
      setAccounts(map);
      const b = (bookRes.data.rows as Book[] | undefined)?.find(
        (x) => x.id === data.bookId,
      );
      setBookName(b?.name ?? '');
    });
  }, [id]);

  if (!voucher) return <div style={{ padding: 20 }}>加载中...</div>;

  const rowsCount = Math.max(voucher.entries.length, 10);
  const debitCents = voucher.entries
    .filter((e) => e.direction === 'debit')
    .reduce((s, e) => s + toCents(e.amount), 0);
  const creditCents = voucher.entries
    .filter((e) => e.direction === 'credit')
    .reduce((s, e) => s + toCents(e.amount), 0);
  const words = amountInChinese(Math.max(debitCents, creditCents));
  const no = String(voucher.voucherNo).padStart(4, '0');

  return (
    <div className="sheet">
      <div className="no-print" style={{ textAlign: 'center', padding: '10px 0' }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '6px 24px', cursor: 'pointer' }}
        >
          打印
        </button>
        <span style={{ marginLeft: 12, color: '#888', fontSize: 12 }}>
          （A4 纵向）
        </span>
      </div>

      <div className="doc-title">记 账 凭 证</div>
      <div className="meta">
        <span>编制单位：{bookName}</span>
        <span>{chineseDate(voucher.date)}</span>
        <span>
          {voucher.voucherType}字第 {no} 号
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: '46mm' }}>摘要</th>
            <th style={{ width: '53mm' }}>会计科目</th>
            <th style={{ width: '38mm' }}>借方金额</th>
            <th style={{ width: '38mm' }}>贷方金额</th>
            <th style={{ width: '10mm' }}>√</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowsCount }).map((_, i) => {
            const e = voucher.entries[i];
            return (
              <tr key={i}>
                <td>{e?.summary ?? ''}</td>
                <td>{e ? (accounts[e.accountId] ?? '') : ''}</td>
                <td className="num">
                  {e && e.direction === 'debit' ? fmtMoney(e.amount) : ''}
                </td>
                <td className="num">
                  {e && e.direction === 'credit' ? fmtMoney(e.amount) : ''}
                </td>
                <td></td>
              </tr>
            );
          })}
          <tr className="total">
            <td className="center">合计</td>
            <td className="amount-words">人民币{words}</td>
            <td className="num">{fmtMoney((debitCents / 100).toFixed(2))}</td>
            <td className="num">{fmtMoney((creditCents / 100).toFixed(2))}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div className="attach">附件 {voucher.attachmentCount} 张</div>
      <div className="sign-row">
        <span>会计主管：____________</span>
        <span>记账：____________</span>
        <span>审核：____________</span>
        <span>制单：____________</span>
        <span>出纳：____________</span>
      </div>
      <div className="page-footer">第 1 页 共 1 页</div>
    </div>
  );
}
