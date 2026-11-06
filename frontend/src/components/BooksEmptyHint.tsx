import { Alert } from 'antd';
import type { Book } from '../hooks/useBooks';

export interface BooksEmptyHintProps {
  books: Book[];
  loading?: boolean;
}

/**
 * 「没有账套」时的统一引导。几乎所有会计页面都依赖账套，
 * 与其让用户面对空下拉框猜原因，不如直接告诉他下一步该做什么。
 */
export default function BooksEmptyHint({ books, loading }: BooksEmptyHintProps) {
  if (loading || books.length > 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message="尚未创建账套"
      description={
        <span>
          账套是记账的最小单位。请先到「系统设置 → 账套管理」新建账套并初始化会计科目，再回到本页。
        </span>
      }
      action={
        <a href="/books" style={{ whiteSpace: 'nowrap' }}>
          去新建
        </a>
      }
    />
  );
}
