import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Spin } from 'antd';
import api from '../api/client';
import { errorMessage } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 账簿 A4 打印页（总账 / 明细账 / 日记账 / 科目余额表 / 试算平衡）。
 *
 * 与查询页分离的原因：
 * 1) 查询页是 antd 表格（筛选器、滚动条、分页器），直接 Ctrl+P 会把这些 UI 一起印出来；
 * 2) 宽表需要横向纸张（@page sheet-landscape），只有独立打印页才能按表宽选纸张方向；
 * 3) 打印件需要账套名、期间、页码、签章行等"账头账尾"，查询页没有。
 */

const MM = 96 / 25.4;
const CONTENT = {
  portrait: Math.round(190 * MM),
  landscape: Math.round(277 * MM),
};

/** 按表格最小内容宽决定纸张方向：纵向 718px / 横向 1047px */
const PAPER: Record<string, 'landscape' | 'portrait'> = {
  general: 'landscape', // 8 列（编码/名称 + 6 个金额列）
  balance: 'landscape',
  journal: 'landscape', // 对方科目名较长
  detail: 'portrait', // 7 列，190mm 内可容纳
  trial: 'portrait',
};

const TITLE: Record<string, string> = {
  general: '总 分 类 账',
  detail: '明 细 分 类 账',
  journal: '日 记 账',
  balance: '科 目 余 额 表',
  trial: '试 算 平 衡 表',
};

const dirText = (d: string) => (d === 'credit' ? '贷' : '借');

export default function LedgerPrint() {
  const [params] = useSearchParams();
  const type = params.get('type') ?? 'general';
  const bookId = Number(params.get('bookId') ?? 0);
  const period = params.get('period') ?? '';
  const startPeriod = params.get('startPeriod') ?? period;
  const endPeriod = params.get('endPeriod') ?? period;
  const accountId = params.get('accountId');
  const journalType = params.get('journalType') ?? 'general';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [bookName, setBookName] = useState('');
  const [generalRows, setGeneralRows] = useState<any[]>([]);
  const [balanceRows, setBalanceRows] = useState<any[]>([]);
  const [trial, setTrial] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [journal, setJournal] = useState<any>(null);

  useEffect(() => {
    document.title = `${TITLE[type] ?? '账簿'} ${startPeriod}~${endPeriod}`;
  }, [type, startPeriod, endPeriod]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!bookId) return;
      setLoading(true);
      try {
        const [bookRes] = await Promise.all([
          api.get('/books').catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        const book = (bookRes.data as { id: number; name: string }[]).find(
          (b) => b.id === bookId,
        );
        setBookName(book?.name ?? '');

        if (type === 'general') {
          const r = await api.get('/ledgers/general', {
            params: { bookId, period: endPeriod },
          });
          if (!cancelled) setGeneralRows(r.data.rows ?? []);
        } else if (type === 'balance') {
          const r = await api.get('/ledgers/account-balance', {
            params: { bookId, period: endPeriod },
          });
          if (!cancelled) setBalanceRows(r.data.rows ?? []);
        } else if (type === 'trial') {
          const r = await api.get('/ledgers/trial-balance', {
            params: { bookId, period: endPeriod },
          });
          if (!cancelled) setTrial(r.data);
        } else if (type === 'detail') {
          if (accountId) {
            const r = await api.get('/ledgers/detail', {
              params: {
                bookId,
                period: endPeriod,
                startPeriod,
                accountId: Number(accountId),
              },
            });
            if (!cancelled) setDetail(r.data);
          }
        } else if (type === 'journal') {
          const r = await api.get('/ledgers/journal', {
            params: { bookId, period: endPeriod, startPeriod, type: journalType },
          });
          if (!cancelled) setJournal(r.data);
        }
      } catch (e) {
        if (!cancelled) setError(errorMessage(e, '加载账簿失败'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [type, bookId, startPeriod, endPeriod, accountId, journalType]);

  const landscape = (PAPER[type] ?? 'portrait') === 'landscape';
  const subtitle = `${startPeriod === endPeriod ? startPeriod : `${startPeriod} ~ ${endPeriod}`}`;

  /** 账头：每页都必须有，散页归位时能读出账套/期间/表名 */
  const head = (
    <>
      <div className="meta">
        <span>编制单位：{bookName || '—'}</span>
        <span>会计期间：{subtitle}</span>
        <span>单位：元</span>
      </div>
      <div className="doc-title report-title">{TITLE[type] ?? '账 簿'}</div>
    </>
  );

  const foot = (pageInfo?: string) => (
    <>
      <div className="sign-row">
        <span>会计主管：</span>
        <span>记账：</span>
        <span>复核：</span>
        <span>制表：</span>
      </div>
      <div className="page-footer">
        {pageInfo ? `${pageInfo} · ` : ''}
        打印日期 {new Date().toLocaleString('zh-CN')}
      </div>
    </>
  );

  const generalTable = (
    <table>
      <colgroup>
        <col style={{ width: '9%' }} />
        <col style={{ width: '21%' }} />
        <col style={{ width: '11.6%' }} />
        <col style={{ width: '11.6%' }} />
        <col style={{ width: '11.6%' }} />
        <col style={{ width: '11.6%' }} />
        <col style={{ width: '11.6%' }} />
        <col style={{ width: '12%' }} />
      </colgroup>
      <thead>
        <tr>
          <th>科目编码</th>
          <th>科目名称</th>
          <th>期初借方</th>
          <th>期初贷方</th>
          <th>本期借方</th>
          <th>本期贷方</th>
          <th>期末借方</th>
          <th>期末贷方</th>
        </tr>
      </thead>
      <tbody>
        {generalRows.map((r) => (
          <tr key={r.accountId ?? r.code}>
            <td className="center">{r.code}</td>
            <td>{r.name}</td>
            <td className="num">{r.initialDebit}</td>
            <td className="num">{r.initialCredit}</td>
            <td className="num">{r.currentDebit}</td>
            <td className="num">{r.currentCredit}</td>
            <td className="num">{r.finalDebit}</td>
            <td className="num">{r.finalCredit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const balanceTable = (
    <table>
      <colgroup>
        <col style={{ width: '9%' }} />
        <col style={{ width: '21%' }} />
        <col style={{ width: '11.6%' }} />
        <col style={{ width: '11.6%' }} />
        <col style={{ width: '11.6%' }} />
        <col style={{ width: '11.6%' }} />
        <col style={{ width: '11.6%' }} />
        <col style={{ width: '12%' }} />
      </colgroup>
      <thead>
        <tr>
          <th>科目编码</th>
          <th>科目名称</th>
          <th>期初借方</th>
          <th>期初贷方</th>
          <th>本期借方</th>
          <th>本期贷方</th>
          <th>期末借方</th>
          <th>期末贷方</th>
        </tr>
      </thead>
      <tbody>
        {balanceRows.map((r) => (
          <tr key={r.accountId ?? r.code}>
            <td className="center">{r.code}</td>
            <td>{r.name}</td>
            <td className="num">{r.initialDebit}</td>
            <td className="num">{r.initialCredit}</td>
            <td className="num">{r.currentDebit}</td>
            <td className="num">{r.currentCredit}</td>
            <td className="num">{r.finalDebit}</td>
            <td className="num">{r.finalCredit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const detailTable = detail && (
    <table>
      <colgroup>
        <col style={{ width: '10%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '38%' }} />
        <col style={{ width: '15%' }} />
        <col style={{ width: '15%' }} />
        <col style={{ width: '12%' }} />
      </colgroup>
      <thead>
        <tr>
          <th>日期</th>
          <th>凭证字号</th>
          <th>摘要</th>
          <th>借方</th>
          <th>贷方</th>
          <th>余额</th>
        </tr>
      </thead>
      <tbody>
        <tr className="carry">
          <td className="center" colSpan={2}>
            期初余额
          </td>
          <td />
          <td />
          <td />
          <td className="num">
            {dirText(detail.opening.direction)} {detail.opening.amount}
          </td>
        </tr>
        {detail.lines.map((l: any, i: number) => (
          <tr key={i}>
            <td className="center">{l.date}</td>
            <td className="center">
              {l.voucherType}-{l.voucherNo}
            </td>
            <td>{l.summary}</td>
            <td className="num">{l.debit}</td>
            <td className="num">{l.credit}</td>
            <td className="num">
              {dirText(l.balanceDirection)} {l.balance}
            </td>
          </tr>
        ))}
        <tr className="total">
          <td className="center" colSpan={2}>
            本期合计
          </td>
          <td />
          <td className="num">{detail.currentDebit}</td>
          <td className="num">{detail.currentCredit}</td>
          <td className="num">
            {dirText(detail.closing.direction)} {detail.closing.amount}
          </td>
        </tr>
      </tbody>
    </table>
  );

  const journalTable = journal && (
    <table>
      <colgroup>
        <col style={{ width: '9%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '28%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '11.3%' }} />
        <col style={{ width: '11.3%' }} />
        <col style={{ width: '11.4%' }} />
      </colgroup>
      <thead>
        <tr>
          <th>日期</th>
          <th>凭证字号</th>
          <th>摘要</th>
          <th>对方科目</th>
          <th>收入(借)</th>
          <th>支出(贷)</th>
          <th>结存</th>
        </tr>
      </thead>
      <tbody>
        <tr className="carry">
          <td className="center" colSpan={3}>
            期初余额
          </td>
          <td />
          <td />
          <td />
          <td className="num">
            {dirText(journal.opening.direction)} {journal.opening.amount}
          </td>
        </tr>
        {journal.lines.map((l: any, i: number) => (
          <tr key={i}>
            <td className="center">{l.date}</td>
            <td className="center">
              {l.voucherType}-{l.voucherNo}
            </td>
            <td>{l.summary}</td>
            <td>{l.oppositeAccount}</td>
            <td className="num">{l.income}</td>
            <td className="num">{l.expense}</td>
            <td className="num">
              {dirText(l.balanceDirection)} {l.balance}
            </td>
          </tr>
        ))}
        <tr className="total">
          <td className="center" colSpan={3}>
            本期合计
          </td>
          <td />
          <td className="num">{journal.summary.totalIncome}</td>
          <td className="num">{journal.summary.totalExpense}</td>
          <td className="num">
            {dirText(journal.summary.direction)} {journal.summary.closing}
          </td>
        </tr>
      </tbody>
    </table>
  );

  const trialTable = trial && (
    <table>
      <colgroup>
        <col style={{ width: '16%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '14%' }} />
      </colgroup>
      <thead>
        <tr>
          <th>项目</th>
          <th>期初借方</th>
          <th>期初贷方</th>
          <th>本期借方</th>
          <th>本期贷方</th>
          <th>期末借方</th>
          <th>期末贷方</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="center bold">期初</td>
          <td className="num">{trial.initialDebit}</td>
          <td className="num">{trial.initialCredit}</td>
          <td />
          <td />
          <td />
          <td />
        </tr>
        <tr>
          <td className="center bold">本期发生</td>
          <td />
          <td />
          <td className="num">{trial.currentDebit}</td>
          <td className="num">{trial.currentCredit}</td>
          <td />
          <td />
        </tr>
        <tr className="total">
          <td className="center bold">期末</td>
          <td />
          <td />
          <td />
          <td />
          <td className="num">{trial.finalDebit}</td>
          <td className="num">{trial.finalCredit}</td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div className="print-root" style={{ background: '#f0f2f5', minHeight: '100vh' }}>
      <div className="print-toolbar no-print" style={{ padding: '12px 16px', textAlign: 'center' }}>
        <Button type="primary" onClick={() => window.print()}>
          打印
        </Button>
        <Button style={{ marginLeft: 8 }} onClick={() => window.close()}>
          关闭
        </Button>
        <span style={{ marginLeft: 12, color: '#666', fontSize: 12 }}>
          {landscape ? 'A4 横向' : 'A4 纵向'} · 打印对话框请关闭「页眉和页脚」
        </span>
      </div>

      {error && <div style={{ textAlign: 'center', color: '#cf1322' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin />
        </div>
      ) : (
        <div className={landscape ? 'sheet report ledger landscape' : 'sheet report ledger'}>
          {head}
          {type === 'general' && generalTable}
          {type === 'balance' && balanceTable}
          {type === 'detail' && detailTable}
          {type === 'journal' && journalTable}
          {type === 'trial' && trialTable}
          {foot()}
        </div>
      )}
    </div>
  );
}
