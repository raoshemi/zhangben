import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { errorMessage, toArray } from '../lib/format';

export interface Account {
  id: number;
  bookId?: number;
  code: string;
  name: string;
  category: string;
  balanceSide: 'debit' | 'credit';
  level: number;
  isLeaf: boolean;
  parentId?: number | null;
  /** 该科目启用的辅助核算类型，如 ['cashflow'] / ['customer','department'] */
  auxFlags: string[];
  isActive?: boolean;
}

export interface AccountsState {
  accounts: Account[];
  /** 只能记账到明细科目 */
  leafAccounts: Account[];
  byId: Map<number, Account>;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function normalizeAccount(raw: any): Account {
  return {
    id: Number(raw?.id),
    bookId: raw?.bookId != null ? Number(raw.bookId) : undefined,
    code: String(raw?.code ?? ''),
    name: String(raw?.name ?? ''),
    category: String(raw?.category ?? 'asset'),
    balanceSide: raw?.balanceSide === 'credit' ? 'credit' : 'debit',
    level: Number(raw?.level ?? 1),
    isLeaf: raw?.isLeaf !== false,
    parentId: raw?.parentId != null ? Number(raw.parentId) : null,
    auxFlags: Array.isArray(raw?.auxFlags)
      ? (raw.auxFlags as unknown[]).map(String)
      : [],
    isActive: raw?.isActive,
  };
}

/**
 * 科目表统一入口：GET /accounts?bookId=（契约不变）。
 * 账套切换时不保留旧账套科目，避免串账套选中错误科目。
 */
export function useAccounts(bookId?: number | null): AccountsState {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (bookId == null) {
      setAccounts([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get('/accounts', { params: { bookId } })
      .then(({ data }) => {
        if (cancelled) return;
        setAccounts(toArray(data).map(normalizeAccount));
      })
      .catch((e) => {
        if (cancelled) return;
        setAccounts([]);
        setError(errorMessage(e, '科目表加载失败'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  const leafAccounts = useMemo(
    () => accounts.filter((a) => a.isLeaf),
    [accounts],
  );
  const byId = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  return { accounts, leafAccounts, byId, loading, error, reload };
}
