import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { errorMessage, toArray } from '../lib/format';

export interface Book {
  id: number;
  name: string;
  accountingStandard: string;
  baseCurrency?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  /** false=单人模式（草稿可直接记账）；true=多人模式（须审核） */
  requireApproval?: boolean;
}

export interface BooksState {
  books: Book[];
  loading: boolean;
  error: string | null;
  /** 首个可用账套，供各页面做默认值 */
  defaultBookId: number | undefined;
  reload: () => void;
}

/**
 * 账套列表统一入口：全局只请求 GET /books（契约不变），
 * 各页面共用同一份 shape，避免出现 /books 与 /ledgers/books 两套字段。
 */
export function useBooks(): BooksState {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<Book[]>('/books')
      .then(({ data }) => {
        if (cancelled) return;
        setBooks(toArray(data) as Book[]);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setBooks([]);
        setError(errorMessage(e, '账套列表加载失败'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const defaultBookId = useMemo(() => books[0]?.id, [books]);

  return { books, loading, error, defaultBookId, reload };
}
