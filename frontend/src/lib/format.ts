/**
 * 前端共用格式化/常量工具。
 * 约定：金额在表单与接口中一律以「字符串 + 两位小数」传递，避免浮点误差；
 *       纯展示计算使用「分」为单位的整数（toCents/centsToMoney）。
 */

export interface VoucherStatusMeta {
  text: string;
  color: string;
}

export const VOUCHER_STATUS: Record<string, VoucherStatusMeta> = {
  draft: { text: '草稿', color: 'default' },
  submitted: { text: '已提交', color: 'blue' },
  approved: { text: '已审核', color: 'cyan' },
  posted: { text: '已记账', color: 'green' },
  voided: { text: '已作废', color: 'red' },
};

export const VOUCHER_TYPES = ['记', '收', '付', '转'] as const;

export const ACCOUNT_CATEGORY_LABEL: Record<string, string> = {
  asset: '资产',
  liability: '负债',
  common: '共同',
  equity: '权益',
  cost: '成本',
  pnl: '损益',
};

export const ACCOUNT_CATEGORY_COLOR: Record<string, string> = {
  asset: 'blue',
  liability: 'orange',
  common: 'purple',
  equity: 'green',
  cost: 'magenta',
  pnl: 'red',
};

export const AUX_TYPE_LABEL: Record<string, string> = {
  customer: '客户',
  supplier: '供应商',
  department: '部门',
  employee: '职员',
  project: '项目',
};

export const STANDARD_LABEL: Record<string, string> = {
  enterprise: '企业会计准则',
  small: '小企业会计准则',
};

/** 字符串金额 → 整数分（按字符串解析，避免 1.005 这类浮点误差），非法输入返回 0 */
export function toCents(value: string | number | null | undefined): number {
  if (value === '' || value == null) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * 100) : 0;
  }
  const s = String(value).replace(/,/g, '').trim();
  if (!s) return 0;
  const neg = s.startsWith('-');
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(neg ? s.slice(1) : s);
  if (!m) return 0;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return neg ? -cents : cents;
}

// ============ 人民币金额大写 ============
const CN_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const CN_SMALL_UNITS = ['仟', '佰', '拾', ''];
const CN_GROUP_UNITS = ['', '万', '亿'];

function sectionToChinese(n: number): string {
  let out = '';
  let pendingZero = false;
  for (let slot = 0; slot < 4; slot++) {
    const digit = Math.floor(n / 10 ** (3 - slot)) % 10;
    if (digit === 0) {
      if (out) pendingZero = true;
    } else {
      if (pendingZero) {
        out += '零';
        pendingZero = false;
      }
      out += CN_DIGITS[digit] + CN_SMALL_UNITS[slot];
    }
  }
  return out;
}

function integerToChinese(n: number): string {
  if (n === 0) return '零';
  const groups: { value: number; index: number }[] = [];
  let rest = n;
  for (let i = 0; rest > 0; i++, rest = Math.floor(rest / 10000)) {
    const g = rest % 10000;
    if (g > 0) groups.push({ value: g, index: i });
  }
  let out = '';
  for (let k = groups.length - 1; k >= 0; k--) {
    const { value, index } = groups[k];
    if (k < groups.length - 1) {
      const lowerIndex = groups[k + 1].index;
      if (index - lowerIndex > 1 || value < 1000) out += '零';
    }
    out += sectionToChinese(value) + CN_GROUP_UNITS[index];
  }
  return out;
}

/** 金额（整数分）→ 人民币大写 */
export function amountInChinese(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  if (abs === 0) return '零元整';
  const yuan = Math.floor(abs / 100);
  const jiao = Math.floor((abs % 100) / 10);
  const fen = abs % 10;
  let out = '';
  if (yuan > 0) out += integerToChinese(yuan) + '元';
  if (jiao === 0 && fen === 0) out += '整';
  else if (jiao > 0) {
    if (yuan === 0) out += '零元';
    out += CN_DIGITS[jiao] + '角' + (fen > 0 ? CN_DIGITS[fen] + '分' : '整');
  } else {
    if (yuan === 0) out += '零元';
    out += '零' + CN_DIGITS[fen] + '分';
  }
  return (neg ? '负' : '') + out;
}

/** 日期 → 中文（2026 年 10 月 31 日） */
export function chineseDate(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return String(d);
  return `${dt.getFullYear()} 年 ${dt.getMonth() + 1} 月 ${dt.getDate()} 日`;
}

/** 整数分 → "1234.00" */
export const centsToMoney = (cents: number): string => (cents / 100).toFixed(2);

/** 千分位展示（表格/汇总用）；空值返回 fallback */
export function fmtMoney(
  value: string | number | null | undefined,
  fallback = '0.00',
): string {
  if (value === '' || value == null) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 金额输入实时清洗：只保留数字与一个小数点，最多两位小数。
 * 这样即使用户粘贴 "1,234.5元" 也不会污染受控值。
 */
export function sanitizeAmount(raw: string): string {
  let s = String(raw ?? '').replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot >= 0) {
    const intPart = s.slice(0, firstDot);
    const decPart = s.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
    s = `${intPart}.${decPart}`;
  }
  return s;
}

/** 失焦时补足两位小数，保证提交满足后端 ^\d+(\.\d{1,2})?$ 规则 */
export function normalizeAmount(raw: string): string {
  const s = sanitizeAmount(raw).trim();
  if (!s || s === '.') return '';
  const n = Number(s);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2);
}

/** 统一的响应体取数组（兼容 data / {items} / {rows}） */
export function toArray(res: unknown): any[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const o = res as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.rows)) return o.rows;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

/** 统一取出接口错误文案 */
export function errorMessage(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('；');
  if (typeof msg === 'string' && msg.trim()) return msg;
  const raw = (e as { message?: string })?.message;
  return raw && raw.trim() && raw !== 'Network Error' ? raw : fallback;
}
