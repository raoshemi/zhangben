import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useBooks } from '../hooks/useBooks';
import type { Book } from '../hooks/useBooks';

const STORAGE_KEY = 'selectedBookId';

export interface BookContextValue {
  books: Book[];
  loading: boolean;
  error: string | null;
  /** 全局当前账套 ID（持久化到 localStorage） */
  bookId: number | undefined;
  book: Book | undefined;
  setBookId: (id: number | undefined) => void;
  reload: () => void;
  /** 是否已选中一个仍存在的账套 */
  ready: boolean;
}

const BookContext = createContext<BookContextValue>({
  books: [],
  loading: false,
  error: null,
  // 页面在未包 Provider 时（如单元测试）回落到 1 号账套，生产环境始终由 BookProvider 提供真实值
  bookId: 1,
  book: undefined,
  setBookId: () => {},
  reload: () => {},
  ready: true,
});

/**
 * 全局账套上下文。
 *
 * 记账是「按账套连续」的业务：一个账套的凭证、账簿、报表是一个闭环，
 * 所以账套选择必须是全局唯一的，避免各页面各自选账套导致串账。
 */
export function BookProvider({ children }: { children: ReactNode }) {
  const { books, loading, error, reload } = useBooks();
  const [bookId, setBookIdState] = useState<number | undefined>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  });

  // 持久化的账套可能已被删除：失效则清空，回到"必须选择"状态
  useEffect(() => {
    if (loading) return;
    if (bookId != null && books.length > 0 && !books.some((b) => b.id === bookId)) {
      setBookIdState(undefined);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [books, loading, bookId]);

  const setBookId = useCallback((id: number | undefined) => {
    if (id == null) return;
    setBookIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  const book = books.find((b) => b.id === bookId);
  const ready = bookId != null && !!book;

  const value = useMemo<BookContextValue>(
    () => ({ books, loading, error, bookId, book, setBookId, reload, ready }),
    [books, loading, error, bookId, book, setBookId, reload, ready],
  );

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}

export function useBook(): BookContextValue {
  return useContext(BookContext);
}
