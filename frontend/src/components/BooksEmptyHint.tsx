import { Alert, Button, Empty, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useBook } from '../context/BookContext';
import { useRole } from '../hooks/useRole';

/**
 * 「没有账套 / 未选账套」的统一非阻塞引导。
 *
 * 设计要点（体验专家结论）：
 * - 不再用全屏遮罩弹窗强制选择：所有页面都可访问，只是数据为空；
 * - 「没有账套」用蓝色（起点/创建），「未选账套」用琥珀色（待补齐），二者动词不同；
 * - 永远用 SPA 跳转（navigate），不用 <a href>，否则整页刷新丢状态。
 */
export default function BooksEmptyHint(_props?: {
  books?: unknown[];
  loading?: boolean;
}) {
  const navigate = useNavigate();
  const { status, books, setBookId, reload } = useBook();
  const { isReadOnly } = useRole();

  if (status === 'loading' || status === 'ready') return null;

  if (status === 'error') {
    return (
      <Alert
        type="error"
        showIcon
        style={{ marginBottom: 16 }}
        message="账套列表加载失败"
        description="网络或服务异常。数据未必为空，请先重试。"
        action={
          <Button size="small" onClick={reload}>
            重试
          </Button>
        }
      />
    );
  }

  if (status === 'empty') {
    return (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="尚未创建账套"
        description="账套是记账的最小单位。创建后系统会按所选会计准则自动初始化科目表与会计期间。"
        action={
          isReadOnly ? (
            <span style={{ color: '#595959', whiteSpace: 'nowrap' }}>
              请联系系统管理员
            </span>
          ) : (
            <Button
              type="primary"
              size="small"
              onClick={() => navigate('/books')}
            >
              新建账套
            </Button>
          )
        }
      />
    );
  }

  // unselected / invalid：直接在提示条里给出可点的账套，一次点击完成选择
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message={status === 'invalid' ? '当前账套不可用' : '未选择账套'}
      description={
        status === 'invalid'
          ? '上次使用的账套可能已被归档或删除，请重新选择一个账套继续。'
          : `选择一个账套后，各页面会显示该账套的凭证、账簿与报表（共 ${books.length} 个可选）。`
      }
      action={
        <Space size={4} wrap>
          {books.slice(0, 3).map((b) => (
            <Button key={b.id} size="small" onClick={() => setBookId(b.id)}>
              {b.name}
            </Button>
          ))}
          {books.length > 3 && (
            <Button size="small" type="link" onClick={() => navigate('/books')}>
              更多…
            </Button>
          )}
        </Space>
      }
    />
  );
}

/** 页面级空态卡：非 ready 时替代业务内容，避免"空表格 + 筛选栏"被误读成"没数据" */
export function BookRequiredState({ hint }: { hint?: string }) {
  const navigate = useNavigate();
  const { status, books, setBookId } = useBook();
  const { isReadOnly } = useRole();

  if (status === 'ready') return null;

  return (
    <div
      style={{
        padding: '64px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div style={{ maxWidth: 420, margin: '0 auto' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1f1f1f' }}>
              {status === 'empty'
                ? '还没有账套'
                : status === 'invalid'
                  ? '当前账套不可用'
                  : '请选择要操作的账套'}
            </div>
            <div style={{ marginTop: 8, color: '#595959' }}>
              {status === 'empty'
                ? '创建账套后，本页会显示该账套的数据。'
                : status === 'invalid'
                  ? '上次使用的账套可能已被归档或删除，请重新选择。'
                  : `你已有 ${books.length} 个账套，选择后本页才会载入数据。`}
            </div>
          </div>
        }
      />
      <div style={{ marginTop: 16 }}>
        {status === 'empty' ? (
          isReadOnly ? (
            <span style={{ color: '#8c8c8c' }}>请联系系统管理员创建账套</span>
          ) : (
            <Button type="primary" onClick={() => navigate('/books')}>
              新建账套
            </Button>
          )
        ) : (
          <Space size={8} wrap>
            {books.map((b) => (
              <Button key={b.id} onClick={() => setBookId(b.id)}>
                {b.name}
              </Button>
            ))}
          </Space>
        )}
      </div>
      {hint && <div style={{ marginTop: 12, color: '#8c8c8c' }}>{hint}</div>}
    </div>
  );
}
