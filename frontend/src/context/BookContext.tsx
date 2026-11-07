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

/**
 * 账套状态机：把「没有账套」「有账套但没选」「选中的已失效」「加载失败」彻底分开。
 * 之前这些都被混成 ready=false，导致各页面把"没权限/没数据/没选"显示成同一种空态。
 */
export type BookStatus =
  | 'loading'
  | 'error'
  | 'empty'
  | 'unselected'
  | 'invalid'
  | 'ready';

export interface BookContextValue {
  books: Book[];
  loading: boolean;
  error: string | null;
  /** 全局当前账套 ID（持久化到 localStorage） */
  bookId: number | undefined;
  book: Book | undefined;
  setBookId: (id?: number) => void;
  reload: () => void;
  /** 是否已选中一个仍存在的账套 */
  ready: boolean;
  /** 明细状态（页面用它决定空态种类） */
  status: BookStatus;
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
  status: 'ready',
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

  // 只有一个账套时自动选中：不必让用户在唯一选项上做一次选择
  useEffect(() => {
    if (loading || error) return;
    if (books.length === 1 && bookId == null) {
      setBookIdState(books[0].id);
      localStorage.setItem(STORAGE_KEY, String(books[0].id));
    }
  }, [books, loading, error, bookId]);

  // 持久化的账套可能已被归档/删除：失效则清空选择。
  // 注意 books.length > 0 守卫不能去掉：新建账套后会先 setBookId 再等列表刷新，
  // 中间有一帧 books 为空，去掉守卫会把刚选中的账套清掉。
  useEffect(() => {
    if (loading || error) return;
    if (bookId != null && books.length > 0 && !books.some((b) => b.id === bookId)) {
      setBookIdState(undefined);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [books, loading, error, bookId]);

  const setBookId = useCallback((id?: number) => {
    if (id == null) {
      setBookIdState(undefined);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    setBookIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  const book = books.find((b) => b.id === bookId);
  const ready = bookId != null && !!book;
  const status: BookStatus = loading
    ? 'loading'
    : error
      ? 'error'
      : books.length === 0
        ? 'empty'
        : bookId == null
          ? 'unselected'
          : ready
            ? 'ready'
            : 'invalid';

  const value = useMemo<BookContextValue>(
    () => ({
      books,
      loading,
      error,
      bookId,
      book,
      setBookId,
      reload,
      ready,
      status,
    }),
    [books, loading, error, bookId, book, setBookId, reload, ready, status],
  );

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}

export function useBook(): BookContextValue {
  return useContext(BookContext);
}
