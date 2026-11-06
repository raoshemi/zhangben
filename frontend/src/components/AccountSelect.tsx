import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Select, Tag, Typography } from 'antd';
import type { Account } from '../hooks/useAccounts';
import { ACCOUNT_CATEGORY_COLOR, ACCOUNT_CATEGORY_LABEL } from '../lib/format';

const { Text } = Typography;

interface AccountOption {
  value: number;
  label: string;
  code: string;
  name: string;
  category: string;
}

export interface AccountSelectProps {
  accounts: Account[];
  value?: number;
  onChange?: (accountId?: number) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  status?: '' | 'error' | 'warning';
  size?: 'small' | 'middle' | 'large';
  style?: CSSProperties;
  autoFocus?: boolean;
  onlyLeaf?: boolean;
  showCategory?: boolean;
  onEnter?: () => void;
}

/**
 * 会计科目选择器（凭证录入 / 明细账 / 固定资产共用）。
 *
 * 相比 Cascader 的关键改进：
 * 1) 一个输入框即可「输编码 / 输名称」定位，1001 回车直接选中，符合会计盲打习惯；
 * 2) 只列出明细科目（非叶子科目不可记账），杜绝"选到一级科目导致账目串级"；
 * 3) 编码用等宽字体左对齐、名称右对齐，长名称省略，下拉可横向扫描。
 */
export default function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = '输入科目编码 / 名称',
  loading = false,
  disabled = false,
  allowClear = true,
  status,
  size = 'middle',
  style,
  autoFocus,
  onlyLeaf = true,
  showCategory = false,
  onEnter,
}: AccountSelectProps) {
  const options = useMemo<AccountOption[]>(
    () =>
      accounts
        .filter((a) => (onlyLeaf ? a.isLeaf : true))
        .map((a) => ({
          value: a.id,
          label: `${a.code} ${a.name}`,
          code: a.code,
          name: a.name,
          category: a.category,
        })),
    [accounts, onlyLeaf],
  );

  return (
    <Select<number, AccountOption>
      style={{ width: '100%', ...style }}
      size={size}
      value={value}
      onChange={(v) => onChange?.(v ?? undefined)}
      options={options}
      placeholder={placeholder}
      loading={loading}
      disabled={disabled}
      allowClear={allowClear}
      status={status}
      autoFocus={autoFocus}
      showSearch
      optionFilterProp="_noop"
      virtual
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnter?.();
      }}
      filterOption={(input, option) => {
        const q = input.trim().toLowerCase();
        if (!q) return true;
        const code = String(option?.code ?? '').toLowerCase();
        const name = String(option?.name ?? '').toLowerCase();
        return (
          code.startsWith(q) ||
          code.includes(q) ||
          name.includes(q) ||
          `${code} ${name}`.includes(q)
        );
      }}
      optionRender={(option) => {
        const data = option.data as unknown as AccountOption;
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
            }}
          >
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: 'rgba(0,0,0,0.45)',
                minWidth: 52,
              }}
            >
              {data.code}
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {data.name}
            </span>
            {showCategory && (
              <Tag
                color={ACCOUNT_CATEGORY_COLOR[data.category]}
                style={{ marginInlineEnd: 0 }}
              >
                {ACCOUNT_CATEGORY_LABEL[data.category] ?? data.category}
              </Tag>
            )}
          </span>
        );
      }}
      notFoundContent={
        loading ? null : (
          <Text type="secondary" style={{ fontSize: 12, padding: 8, display: 'block' }}>
            {accounts.length === 0
              ? '当前账套暂无科目，请先在「系统设置 → 会计科目」初始化'
              : '无匹配科目，可只输入编码前缀，例如 1001'}
          </Text>
        )
      }
    />
  );
}
