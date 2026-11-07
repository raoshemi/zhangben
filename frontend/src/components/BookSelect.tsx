import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Select, Typography } from 'antd';
import type { Book } from '../hooks/useBooks';
import { STANDARD_LABEL } from '../lib/format';

const { Text } = Typography;

export interface BookSelectProps {
  books: Book[];
  value?: number;
  onChange?: (bookId?: number) => void;
  placeholder?: string;
  allowClear?: boolean;
  loading?: boolean;
  disabled?: boolean;
  showStandard?: boolean;
  style?: CSSProperties;
  size?: 'small' | 'middle' | 'large';
  /** 未选账套时用 warning 边框持续提醒 */
  status?: 'error' | 'warning';
}

/**
 * 账套选择器。所有会计页面共用同一措辞「选择账套」，降低认知切换成本。
 */
export default function BookSelect({
  books,
  value,
  onChange,
  placeholder = '选择账套',
  allowClear = false,
  loading = false,
  disabled = false,
  showStandard = true,
  style,
  size = 'middle',
  status,
}: BookSelectProps) {
  const options = useMemo(
    () =>
      books.map((b) => {
        const std = STANDARD_LABEL[b.accountingStandard] ?? b.accountingStandard;
        const suffix = b.isActive === false ? '（已停用）' : '';
        return {
          value: b.id,
          label: showStandard ? `${b.name}（${std}）${suffix}` : `${b.name}${suffix}`,
          name: b.name,
          standard: std,
        };
      }),
    [books, showStandard],
  );

  return (
    <Select<number>
      style={{ width: 240, ...style }}
      size={size}
      value={value}
      onChange={(v) => onChange?.(v ?? undefined)}
      options={options}
      placeholder={placeholder}
      loading={loading}
      disabled={disabled}
      allowClear={allowClear}
      status={status}
      showSearch
      optionFilterProp="name"
      optionRender={(option) => {
        const data = option.data as unknown as { name: string; standard: string };
        return (
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>{data.name}</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {data.standard}
            </Text>
          </span>
        );
      }}
      notFoundContent={
        loading ? null : (
          <Text type="secondary" style={{ fontSize: 12, padding: 8, display: 'block' }}>
            没有匹配的账套
          </Text>
        )
      }
    />
  );
}
