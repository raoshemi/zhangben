# 前端交互与信息架构评审（React 19 + Ant Design 5）

> 范围：`frontend/src/pages/*.tsx`、`frontend/src/App.tsx`、`frontend/src/layout/`、新增 `frontend/src/components/`、`frontend/src/hooks/`、`frontend/src/lib/`
> 约束遵守：**未改动后端 API 契约**、**未放宽 RBAC（只做前端收敛）**、**全部基于 Ant Design 5.29**
> 评审对象：中国会计准则记账系统（企业 / 小企业准则，不含进销存）

---

## 0. 结论摘要

| 维度 | 改造前 | 改造后 |
| --- | --- | --- |
| 科目选择 | 级联选择器（Cascader），只能逐级点开，搜索仅在当前层级生效，**可选到非明细科目** | 单框输入「编码 / 名称」即定位、只列明细科目、编码等宽左对齐 |
| 借贷方向 | 每行手工下拉选择，与科目余额方向无关，易出错 | 选科目后**按余额方向自动带出**（可手动覆盖），改用一键 Segmented |
| 平衡校验 | 底部一行 Tag，不平衡时只说"不平衡" | 实时显示**借方/贷方合计 + 差额**，支持"按差额补足"，保存时给出具体差额 |
| 行操作 | 只有删除（且无原因说明），不能复制 | 复制本行 + 删除（Tooltip 说明最少两行），Enter 在末行追加、Ctrl/⌘+S 保存 |
| 报表查询 | 每次点「查询」只取**当前标签**那张表；切标签即清空重查 | 一次查询**三张表并发拉取**，切标签零请求；单表失败只影响该标签并可单独重试 |
| 信息架构 | 10 个一级菜单平铺，账套/科目/辅助核算/现金流量与凭证、账簿混在一起 | 按业务流分 4 组，全局配置统一收进「系统设置」子菜单 |
| 通用体验 | loading/空态/错误提示各页各写，错误只弹 message，按钮层级混乱 | 统一 `PageHeader` / `BookSelect` / `AccountSelect` / `AmountInput` / 空态文案 / 失败可重试 |

代码层面：`tsc --noEmit` 通过，`vite build` 通过，Jest **16 个测试套件 / 22 个用例全绿**（含新增的 4 个回归用例）。

---

## 1. 凭证录入：从"能录"到"顺手"

文件：`frontend/src/pages/VoucherEdit.tsx`（整体重写）+ 新增 `components/AccountSelect.tsx`、`components/AmountInput.tsx`

### 1.1 科目按编号搜索（P0）

**问题**：原实现是 `Cascader` + `showSearch`。级联搜索只匹配「当前已展开层级」的文案，会计最常用的"直接敲 1001 回车"路径走不通；而且叶子/非叶子一视同仁，选到 1001 一级科目也能提交（后端只校验科目属于该账套，不校验是否明细），事后对账极难发现。

**改法**：新组件 `AccountSelect`，用单层 `Select` + 自定义 `filterOption` + `optionRender`：

```tsx
const options = accounts
  .filter((a) => (onlyLeaf ? a.isLeaf : true))     // 只列明细科目
  .map((a) => ({ value: a.id, label: `${a.code} ${a.name}`, code: a.code, name: a.name }));

<Select
  showSearch
  filterOption={(input, option) => {
    const q = input.trim().toLowerCase();
    if (!q) return true;
    const code = String(option?.code ?? '').toLowerCase();
    const name = String(option?.name ?? '').toLowerCase();
    return code.startsWith(q) || code.includes(q) || name.includes(q)
        || `${code} ${name}`.includes(q);
  }}
  optionRender={(option) => (
    <span style={{ display: 'flex', gap: 8 }}>
      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: 'rgba(0,0,0,.45)', minWidth: 52 }}>
        {option.data.code}
      </span>
      <span style={{ flex: 1 }}>{option.data.name}</span>
    </span>
  )}
/>
```

效果：输入 `1001` → 只剩「1001 库存现金」，回车即选中；输入「现金」也能命中；`aria` 层面仍是标准 `combobox`，E2E 与无障碍都不受损。

### 1.2 方向联动（P0）

三个联动动作合并到 `applyAccount()`：

```tsx
const applyAccount = (key: string, accountId?: number) => {
  const account = accountId != null ? accountById.get(accountId) : undefined;
  setRows((prev) => prev.map((r) => {
    if (r.key !== key) return r;
    const next: EntryRow = { ...r, accountId, cashflowItemId: undefined, auxIds: [] };
    if (account) {
      // ① 方向按余额方向自动带出；用户手动改过（directionTouched）则尊重用户
      if (!r.directionTouched) next.direction = account.balanceSide === 'credit' ? 'credit' : 'debit';
      // ② 摘要为空时用科目名称预填，减少重复打字
      if (!r.summary.trim()) next.summary = account.name;
    }
    return next;                      // ③ 清空与新科目不匹配的现金流量/辅助项
  }));
};
```

方向控件从「下拉（两次点击）」换成「Segmented（一次点击）」，并加 Tooltip 说明默认值来源：

```tsx
<Segmented
  size="small" block
  value={r.direction}
  options={[{ label: '借', value: 'debit' }, { label: '贷', value: 'credit' }]}
  onChange={(v) => updateRow(r.key, { direction: v as Direction, directionTouched: true })}
/>
```

> 会计口径收益：负债/权益类科目（如 4001 实收资本，`balanceSide=credit`）不再出现"选了科目却默认借方"的错向凭证。

### 1.3 行删除 / 行操作（P1）

```tsx
<Space size={0}>
  <Tooltip title="复制本行（金额清空）">
    <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => duplicateRow(r.key)} />
  </Tooltip>
  <Tooltip title={rows.length <= 2 ? '至少保留两行分录' : '删除本行'}>
    <Button type="text" size="small" danger icon={<DeleteOutlined />}
            disabled={rows.length <= 2} onClick={() => removeRow(r.key)} />
  </Tooltip>
</Space>
```

- 复制行**清空金额**：避免复制出等额分录把凭证搞成不平衡；
- 删除禁用时给出原因（后端要求 `ArrayMinSize(2)`），不再让按钮"莫名变灰"；
- 删除同时清掉该行的校验错误，避免"幽灵红字"。

### 1.4 借贷平衡提示（P0）

金额一律以「整数分」聚合，杜绝 `0.1+0.2` 类浮点误差：

```tsx
const totals = useMemo(() => {
  let debit = 0, credit = 0;
  for (const r of rows) {
    const cents = toCents(r.amount);
    if (r.direction === 'debit') debit += cents; else credit += cents;
  }
  return { debit, credit, diff: debit - credit, balanced: debit === credit };
}, [rows]);
```

展示层从"一个 Tag"升级为「合计 + 差额 + 一键补足」：

```
借方合计：0.00   贷方合计：100.00   [借贷不平衡（差额 100.00）]  按差额补足 100.00 元
```

```tsx
{!totals.balanced && emptyAmountRows.length === 1 && (
  <Button type="link" size="small" onClick={() => {
    const target = emptyAmountRows[0];
    updateRow(target.key, {
      amount: centsToMoney(Math.abs(totals.diff)),
      direction: totals.diff > 0 ? 'credit' : 'debit',
      directionTouched: true,
    });
  }}>
    按差额补足 {centsToMoney(Math.abs(totals.diff))} 元
  </Button>
)}
```

保存时的错误文案也带上具体金额："借贷不平衡：借方合计 100.00 元，贷方合计 0.00 元，差额 100.00 元"。

### 1.5 字段级校验 + 定位到行（P1）

原来串行 `message.error` 逐条弹，用户修完第一条才发现第二条。现在：

1. `validate()` 收集**行级字段错误**（摘要 / 科目 / 金额 / 现金流量），`Record<rowKey, Partial<Record<field, msg>>>`；
2. 出错字段就地标红（`status="error"` + 字段下方一行红字），并在表头汇总一条 Alert："还有 N 处分录信息需要修正"；
3. 自动滚动到**第一个**出错行：

```tsx
const focusFirstError = (errors: RowErrors) => {
  const firstKey = rows.find((r) => errors[r.key])?.key;
  if (!firstKey) return;
  window.setTimeout(() => {
    document.querySelector(`tr[data-row-key="${firstKey}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 0);
};
```

4. 现金流量项目**按科目 `auxFlags` 联动**：科目启用 `cashflow` 才可填、且必填；未启用则禁用并提示"当前科目无需填列"。提交前还会做一次防御性过滤，避免后端 400「科目未启用现金流量辅助核算」。

### 1.6 快捷操作（P2，已实现基础版）

| 操作 | 快捷方式 |
| --- | --- |
| 末行追加分录 | 摘要/科目/金额输入框内按 `Enter` |
| 保存凭证 | `Ctrl/⌘ + S`（阻止浏览器另存为） |
| 复制行 | 行尾复制按钮（金额清空） |
| 关闭未保存抽屉 | 弹确认「放弃并关闭 / 继续录入」 |

```tsx
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void saveRef.current(false);
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, []);
```

### 1.7 其它细节

- 表头新增 `#` 行号列，便于"第 3 行金额错了"的沟通；
- 账套在表头以文本展示（原为 disabled 的 `InputNumber value=1`，信息量为零）；
- 凭证日期与账套启用期间比对，超出范围给出 warning Alert（并给 DatePicker `status="warning"`）；
- 余额方向列标题带 Tooltip：「默认按科目余额方向自动带出，可手动调整」；
- 新增「保存并继续录入」：保留凭证字/日期/账套，清空分录并聚焦第一行摘要（连续录单场景几乎必用）。

---

## 2. 财务报表：一次查询，三表齐活

文件：`frontend/src/pages/Reports.tsx`（重写），接口仍为三个既有 GET（`/reports/balance-sheet`、`/reports/income-statement`、`/reports/cash-flow`），**契约零变更**。

### 2.1 问题定位

原实现 `query()` 用 `activeTab` 决定请求哪一张；`Tabs.onChange` 里 `setActiveTab(k); setReport(null)`。结果：

- 切一次标签 = 一次网络往返 + 一次全表 loading 闪烁；
- 三张表共用一份 `report` 状态，失败信息互相覆盖；
- 进入页面默认 `bookId=undefined`，必须先手动选账套才能查询（多一次点击 + 一次空态）。

### 2.2 新数据流

```tsx
const TAB_META = {
  balance:  { title: '资产负债表', url: '/reports/balance-sheet' },
  income:   { title: '利润表',    url: '/reports/income-statement' },
  cashflow: { title: '现金流量表', url: '/reports/cash-flow' },
} as const;

const fetchReport = async (key, params, reqId) => {
  try {
    const res = await api.get(TAB_META[key].url, { params });
    if (reqIdRef.current !== reqId) return;          // 竞态保护：旧请求不覆盖新结果
    setData((prev) => ({ ...prev, [key]: res.data }));
  } catch (e) {
    if (reqIdRef.current !== reqId) return;
    setErrors((prev) => ({ ...prev, [key]: errorMessage(e, `${TAB_META[key].title}查询失败`) }));
  } finally {
    if (reqIdRef.current === reqId) setLoadingTabs((prev) => prev.filter((k) => k !== key));
  }
};

const runQuery = async (nextBookId?, nextPeriod?) => {
  const reqId = ++reqIdRef.current;
  setData({}); setErrors({});
  setLoadingTabs(['balance', 'income', 'cashflow']);
  const params = { bookId: b, period: p.format('YYYY-MM') };
  await Promise.all(TAB_KEYS.map((key) => fetchReport(key, params, reqId)));  // 并发三连
  if (reqIdRef.current === reqId) setQuerying(false);
};
```

- **切换标签只读内存**：`Tabs` 的 `onChange` 只 `setActiveTab`，不再发请求、不再清空；
- **状态是「每表独立」**：`data[tab]` / `errors[tab]` / `loadingTabs.includes(tab)`，一张失败不影响另外两张；
- **标签自带状态徽标**：加载中 ⟳ / 失败 ⚠ / 已加载 ✓，用户不用逐个点开确认；
- **单表重试**：失败标签页内提供「只重试本表」，不重跑另外两张；
- **条件变更提示**：改了账套或期间后，页面顶部出现"查询条件已变更，当前展示的仍是上一次查询结果"，避免"看着旧数据以为是新数据"（财务场景的严重误导）；
- **进入即加载**：账套列表回来后自动选第一个账套并跑一次三表查询，`ref` 保证只跑一次（StrictMode 双调用也不会重复请求）。

### 2.3 打印

打印按钮改为「打印当前标签页」，且仅当该标签已有数据时可用（`disabled={!data[activeTab]}` + Tooltip 说明），URL 仍为既有 `/print/report?bookId&period&type=`，`ReportPrint.tsx` 无需改动。

### 2.4 回归用例（新增）

`frontend/src/pages/Reports.query.test.tsx`：

- 断言「进入页面即产生 3 个 `/reports/*` 请求」；
- 连续切到利润表、现金流量表后，`/reports/*` 请求数**仍为 3**（这是本次目标的可执行证明）；
- 断言单表 500 时只有该标签显示错误与重试入口。

---

## 3. 信息架构：菜单分组与「系统设置」

### 3.1 现状问题

改造前 10 个一级菜单平铺：仪表盘 / 账套管理 / 会计科目 / 辅助核算 / 现金流量 / 凭证管理 / 账簿查询 / 期末处理 / 财务报表 / 固定资产。

三个结构性问题：

1. **配置类与业务类混排**：账套、科目、辅助核算、现金流量项目都是"一年改几次"的全局设置，却和"每天几十次"的凭证录入平级，且排在最前面，高频入口被推到列表中部；
2. **缺少分组语义**：10 项平铺时用户靠位置记忆，新增功能只能往下堆；
3. **角色不可见性缺失**：`GET /assets` 与全部写操作都是 `@Roles('admin')`，但界面照常展示，非管理员每次点进去都是 403。

### 3.2 落地后的菜单结构

```
工作台                         /
日常核算（分组）
  ├ 凭证管理                   /vouchers       → 序时簿 + 抽屉录入
  └ 固定资产                   /assets         （仅 admin 可见）
账簿与报表（分组）
  ├ 账簿查询                   /ledgers        总账/明细账/日记账/余额表/试算平衡
  └ 财务报表                   /reports        资产负债表/利润表/现金流量表
期末（分组）
  └ 期末处理                   /closing        损益结转 → 结账 → 反结账
系统设置（子菜单，可折叠）
  ├ 账套管理                   /books          （写操作仅 admin）
  ├ 会计科目                   /accounts       （写操作仅 admin）
  ├ 辅助核算                   /auxiliary      （写操作仅 admin）
  └ 现金流量项目               /cashflow       （写操作仅 admin）
```

### 3.3 分组依据（举一反三的规则）

| 分组 | 判定规则 | 现有成员 | 未来可落位 |
| --- | --- | --- | --- |
| 工作台 | 一眼看全局 + 待办入口 | 仪表盘 | 待办中心、消息 |
| 日常核算 | **按笔发生**的业务，天天用 | 凭证、固定资产 | 凭证审核、出纳、进销存（若做） |
| 账簿与报表 | **按期间查询**的产物，共享「账套+期间」范式 | 账簿查询、财务报表 | 报表中心、申报表导出 |
| 期末 | 月/年**一次性动作**，有严格先后顺序 | 期末处理 | 年结、审计调整 |
| 系统设置 | **全局一次性配置**，与具体凭证无关 | 账套/科目/辅助核算/现金流量项目 | 用户与权限、打印模板、系统参数、备份 |

判定口诀：*"这笔业务每天做吗？→ 日常核算；是查历史吗？→ 账簿与报表；一月一次吗？→ 期末；一年改几次吗？→ 系统设置。"*

### 3.4 关键取舍

- **路由路径保持不变**（`/books`、`/accounts`…）。菜单只是入口重组，书签、`window.open('/print/...')`、E2E 全部不受影响；
- 采用 `Menu` 的 `type: 'group'`（不可点击的分组标题）+ 一个真正可折叠的「系统设置」`SubMenu`，避免为了分组制造假的父级路由；
- `defaultOpenKeys` 按当前路径推导：身处 `/accounts` 时「系统设置」自动展开，用户不会"点进去后菜单收起找不到自己"；
- 菜单 + 面包屑同源（`ROUTE_META` 一张表），保证"我在哪 / 我从哪来"一致。

```tsx
const ROUTE_META = {
  '/vouchers': { group: '日常核算', label: '凭证管理' },
  '/reports':  { group: '账簿与报表', label: '财务报表' },
  '/accounts': { group: '系统设置', label: '会计科目' },
  // …
};
```

### 3.5 RBAC 收敛（保持后端不变，前端不再"骗点击"）

新增 `hooks/useRole.ts` 作为唯一角色能力来源：

```tsx
export function buildRoleState(role: string | null): RoleState {
  const known = role != null;
  const isAdmin = role === 'admin';
  const canPost = !known || isAdmin || role === 'poster';
  return {
    role, isAdmin,
    isReadOnly: known && !isAdmin,
    canApprove: !known || isAdmin || role === 'approver',
    canPost,
    canVoid: !known || canPost || role === 'accountant' || role === 'approver',
    canManageSettings: !known || isAdmin,
    canManageAssets: !known || isAdmin,
    canRunClosing: !known || isAdmin,
  };
}
```

规则：**"角色未知时不收窄能力，由后端 403 兜底；角色已知时按钮直接不显示/禁用并说明原因"**。落地位置：

| 位置 | 变化 |
| --- | --- |
| 菜单 | 固定资产仅 admin 可见（controller 级 `@Roles('admin')`） |
| `App.tsx` | `/assets` 增加 `RequireAdmin` 守卫，非 admin 显示 403 Result |
| 凭证序时簿 | 审核/记账/冲销/作废按 `canApprove/canPost/canVoid` 显示（原来作废对所有人可见） |
| 账套/科目/辅助/现金流量/期末 | 写操作按钮 `disabled` + Tooltip「仅系统管理员可…」，页面顶部说明当前为只读 |

### 3.6 顶栏

- 面包屑（首页 › 日常核算 › 凭证管理）替代"只有 Logo"的空白顶栏；
- 角色 Tag（系统管理员 / 审核员 / 记账员 / 会计 / 只读用户）让人清楚"为什么这个按钮没有"；
- 退出收进用户下拉（原为一个常驻按钮，误点风险高）。

---

## 4. 通用体验规范（表单校验 / loading / 空态 / 按钮层级 / 快捷操作）

### 4.1 新增共享层

| 文件 | 作用 |
| --- | --- |
| `src/lib/format.ts` | 金额分/元换算、金额清洗与两位小数归一、状态字典、`errorMessage` 统一取后端 message |
| `src/hooks/useBooks.ts` | 统一 `GET /books`（含 loading/error/reload），取代各页面各自 `api.get('/books')` 与 `/ledgers/books` 两套写法 |
| `src/hooks/useAccounts.ts` | 统一 `GET /accounts?bookId`，产出 `accounts / leafAccounts / byId`，切换账套自动丢弃旧数据 |
| `src/hooks/useRole.ts` | 角色能力中心（见 3.5） |
| `src/components/AccountSelect.tsx` | 科目选择器（凭证、明细账、固定资产共用） |
| `src/components/BookSelect.tsx` | 账套选择器，统一措辞与「无账套」引导 |
| `src/components/AmountInput.tsx` | 金额输入（只允许数字+1 个小数点+2 位小数，失焦补 `.00`） |
| `src/components/PageHeader.tsx` | 统一「H1 → 说明 → 右侧主操作」 |
| `src/components/BooksEmptyHint.tsx` | 无账套时的统一引导（含跳转「系统设置 → 账套管理」） |

### 4.2 按钮层级规范

| 层级 | 用法 | 例子 |
| --- | --- | --- |
| `type="primary"`（每屏 1 个） | 该页主动作 | 查询 / 保存凭证 / 新建账套 / 新增 |
| 默认按钮 | 次要动作 | 刷新、打印、提交、重置筛选 |
| `type="text"` / `link` | 行内动作 | 复制行、按差额补足 |
| `danger` + `Popconfirm` | 破坏性动作 | 作废、反结账、冲销（Popconfirm 里补一句后果说明） |

同时修掉了两处"主次不分"：账套管理的「新建账套」不再与「刷新」同为 primary；期末处理的「结账」保持 primary，其余降级。

### 4.3 loading 分级

| 场景 | 表现 |
| --- | --- |
| 首次加载列表 | 表格 `loading` + 骨架（报表用 `Skeleton`） |
| 点击查询 | 按钮 `loading`（`querying`），表格不整体变灰，避免闪烁 |
| 行级动作（结账/提交） | 按钮 `loading={acting === row.period}`，同一行其他按钮不阻塞 |
| 引用数据加载中 | 下拉 `loading`，占位文案提示"正在加载"而非"无数据" |

### 4.4 空态三态文案

统一为「**为什么空 + 下一步做什么**」，且区分三种成因：

| 成因 | 文案示例 |
| --- | --- |
| 没数据 | "本期还没有凭证，点击右上角开始录入第一张凭证" |
| 筛选无结果 | "当前筛选条件下没有凭证，试试放宽期间或清空关键词" |
| 前置条件缺失 | "尚未创建账套 → 请先到系统设置 › 账套管理 新建账套" |

### 4.5 错误处理

所有 catch 统一走 `errorMessage(e, fallback)`（兼容后端 `message` 为 `string | string[]`），并且**不再只弹 toast**：列表页顶部保留可重试的 Alert（`retry` 按钮），报表页按标签页保留错误。

### 4.6 其它页面改动一览

| 页面 | 主要改动 |
| --- | --- |
| `VoucherList.tsx` | 账套由 `InputNumber` 换成 `BookSelect`；筛选区加「重置筛选」；空态/角色/确认文案；抽屉关闭脏检查；分页文案保持 `共 N 条` |
| `Ledgers.tsx` | 明细账的"科目 ID 输入框"换成 `AccountSelect`（可用编码检索）；期初/本期/期末从一行长文本改为 `Descriptions`；各表补空态与重试 |
| `Accounts.tsx` | 树形展开（默认展开汇总科目）、编码/名称搜索、类别筛选、辅助核算标签、统计行 |
| `Auxiliary.tsx` / `CashFlow.tsx` | 加载/错误/空态、搜索、非法角色禁用写操作、Modal `confirmLoading`、表单必填提示 |
| `Books.tsx` | 加载/错误/空态；期间改区间月份选择并按月起止日保存；准则说明；创建后引导"下一步初始化科目" |
| `Closing.tsx` | 期末流程说明改为 Alert；按钮按角色禁用；确认弹窗补齐后果说明 |
| `Dashboard.tsx` | 修复"凭证数量"恒为 0 的 bug（改为读分页 `total`）；新增「待提交草稿」；顶部快捷入口 |
| `Assets.tsx` | 写操作按角色禁用（原 controller 级 admin 限制，前端无提示） |

---

## 5. 验证与遗留

### 5.1 已验证

```
npx tsc --noEmit          ✅ 通过（strict 模式）
npx vite build            ✅ 通过（3.34 kB CSS / 1.48 MB JS）
npx jest                  ✅ 16 suites / 22 tests 全绿
```

新增回归用例：

- `src/components/AccountSelect.test.tsx`：编码前缀筛选、中文名筛选、非明细科目不可选；
- `src/pages/VoucherEdit.balance.test.tsx`：金额失焦补两位小数、差额提示、改方向后合计归属正确；
- `src/pages/Reports.query.test.tsx`：一次查询三表并发、切标签零请求、单表失败可重试；
- `src/layout/MainLayout.test.tsx`：分组存在、系统设置收纳、辅助核算不再出现在一级菜单。

### 5.2 未验证（需真实环境）

- **Playwright E2E**：`frontend/e2e/*.spec.ts` 已按新交互重写（账号密码、`data-row-key` 行定位、Segmented 方向、下拉选项点击、菜单子级展开、用户下拉退出），但本机没有起后端与 `E2E_BASE_URL`，**未执行**。执行前请先 `pnpm --dir backend start:dev` + `npm --dir frontend run dev`，再 `npm --dir frontend run test:e2e`。
- 生产构建注意：本机 `%TEMP%` 目录对 esbuild 清理临时文件受限，构建需把 `TMP`/`TEMP` 指到工作区目录（命令：`$env:TMP="<repo>/.tmpbuild"; npx vite build`）。与代码无关。

### 5.3 后续路线（按建议优先级）

1. **P1 全局账套上下文**：顶栏放一个全局账套选择器（写 `localStorage`），各页共享；现在每页各有一份 `bookId` 状态，跨页切换账套要重选 5 次。
2. **P1 凭证查看/编辑**：`PATCH /vouchers/:id` 已存在，但前端只有"新增"，草稿改不了——`VoucherEdit` 加 `voucherId` 回填即可复用。
3. **P2 科目余额联动校验**：录入时对"现金类科目金额为负"、"损益类科目出现在非结转凭证"等做软提示（黄色 warning，不阻断）。
4. **P2 报表打印全套**：`ReportPrint` 支持 `type=all` 连续打印三张表。
5. **P2 期末检查清单**：结账前一次性列出"未审核凭证 N 张 / 试算不平衡 / 未结转损益"，替代逐个试错。
6. **P2 暗色主题**：`ConfigProvider` + `theme.darkAlgorithm`，会计夜间录入场景可选；当前浅色为主，暂不做跟随系统。
7. **P3 表格列设置与导出**：账簿/余额表加列显隐与 Excel 导出。

---

## 6. 改动文件清单

新增：

```
frontend/src/lib/format.ts
frontend/src/hooks/useRole.ts
frontend/src/hooks/useBooks.ts
frontend/src/hooks/useAccounts.ts
frontend/src/components/PageHeader.tsx
frontend/src/components/BookSelect.tsx
frontend/src/components/AccountSelect.tsx
frontend/src/components/AmountInput.tsx
frontend/src/components/BooksEmptyHint.tsx
frontend/src/components/AccountSelect.test.tsx
frontend/src/layout/MainLayout.test.tsx
frontend/src/pages/Reports.query.test.tsx
frontend/src/pages/VoucherEdit.balance.test.tsx
```

修改：

```
frontend/src/App.tsx                     # 固定资产路由 RequireAdmin 守卫
frontend/src/layout/MainLayout.tsx       # 菜单分组 + 系统设置 + 面包屑 + 角色 Tag + 用户下拉
frontend/src/pages/VoucherEdit.tsx       # 凭证录入交互整体重写
frontend/src/pages/VoucherList.tsx       # 账套选择/筛选重置/角色/空态/脏检查
frontend/src/pages/Reports.tsx           # 一次查询三表 + 标签缓存 + 分表错误
frontend/src/pages/Ledgers.tsx           # 科目选择器 + Descriptions + 空态
frontend/src/pages/Accounts.tsx          # 树形 + 搜索 + 统计
frontend/src/pages/Auxiliary.tsx         # loading/空态/RBAC/表单校验
frontend/src/pages/CashFlow.tsx          # loading/空态/RBAC/表单校验
frontend/src/pages/Books.tsx             # loading/空态/RBAC/期间表单
frontend/src/pages/Closing.tsx           # 流程说明/角色/确认文案
frontend/src/pages/Dashboard.tsx         # 凭证数量 bug 修复 + 快捷入口
frontend/src/pages/Assets.tsx            # 写操作 RBAC
frontend/e2e/helpers.ts                  # 菜单子级展开 / 用户下拉退出 / 共用录凭证流程
frontend/e2e/navigation.spec.ts
frontend/e2e/pages.spec.ts
frontend/e2e/voucher-entry.spec.ts
frontend/e2e/multi-role.spec.ts
```

**未改动**：`backend/` 全部文件（含 DTO、controller、service）、`VoucherPrint.tsx`、`ReportPrint.tsx`、`Login.tsx`、`App` 路由路径。
