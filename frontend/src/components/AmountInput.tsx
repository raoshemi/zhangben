import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Input } from 'antd';
import { normalizeAmount, sanitizeAmount } from '../lib/format';

export interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  status?: '' | 'error' | 'warning';
  size?: 'small' | 'middle' | 'large';
  style?: CSSProperties;
  autoFocus?: boolean;
  onPressEnter?: () => void;
}

/**
 * 金额输入框。
 *
 * 设计要点：
 * - 编辑期只允许「数字 + 一个小数点 + 最多两位小数」，粘贴脏字符自动清洗；
 * - 失焦自动补两位小数（100 → 100.00），保证提交满足后端金额正则；
 * - 右对齐 + 等宽字体，借贷两列纵向可比较，符合凭证习惯。
 */
export default function AmountInput({
  value,
  onChange,
  placeholder = '0.00',
  disabled,
  status,
  size = 'middle',
  style,
  autoFocus,
  onPressEnter,
}: AmountInputProps) {
  const [text, setText] = useState(value ?? '');

  useEffect(() => {
    setText(value ?? '');
  }, [value]);

  return (
    <Input
      value={text}
      size={size}
      disabled={disabled}
      status={status}
      autoFocus={autoFocus}
      inputMode="decimal"
      placeholder={placeholder}
      style={{
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
      onChange={(e) => {
        const next = sanitizeAmount(e.target.value);
        setText(next);
        onChange(next);
      }}
      onBlur={() => {
        const next = normalizeAmount(text);
        if (next !== text) setText(next);
        if (next !== value) onChange(next);
      }}
      onPressEnter={onPressEnter}
    />
  );
}
