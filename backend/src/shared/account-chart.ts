// 会计科目种子数据：企业会计准则 + 小企业会计准则
export type Category = 'asset' | 'liability' | 'common' | 'equity' | 'cost' | 'pnl';
export type Side = 'debit' | 'credit';

export interface SeedAccount {
  code: string;
  name: string;
  category: Category;
  side: Side;
  aux?: string[]; // customer|supplier|department|employee|project|cashflow
  children?: SeedAccount[];
}

// ============================================================
// 企业会计准则（一级 4 位编码 + 常用明细）
// ============================================================
export const enterpriseAccounts: SeedAccount[] = [
  // ---------- 资产类 ----------
  { code: '1001', name: '库存现金', category: 'asset', side: 'debit', aux: ['cashflow'] },
  { code: '1002', name: '银行存款', category: 'asset', side: 'debit', aux: ['cashflow'] },
  { code: '1012', name: '其他货币资金', category: 'asset', side: 'debit', aux: ['cashflow'] },
  { code: '1121', name: '应收票据', category: 'asset', side: 'debit' },
  { code: '1122', name: '应收账款', category: 'asset', side: 'debit', aux: ['customer'] },
  { code: '1123', name: '预付账款', category: 'asset', side: 'debit', aux: ['supplier'] },
  { code: '1131', name: '应收股利', category: 'asset', side: 'debit' },
  { code: '1132', name: '应收利息', category: 'asset', side: 'debit' },
  { code: '1221', name: '其他应收款', category: 'asset', side: 'debit', aux: ['employee', 'department'] },
  { code: '1231', name: '坏账准备', category: 'asset', side: 'credit' },
  { code: '1401', name: '材料采购', category: 'asset', side: 'debit' },
  { code: '1402', name: '在途物资', category: 'asset', side: 'debit' },
  { code: '1403', name: '原材料', category: 'asset', side: 'debit' },
  { code: '1404', name: '材料成本差异', category: 'asset', side: 'debit' },
  { code: '1405', name: '库存商品', category: 'asset', side: 'debit' },
  { code: '1407', name: '商品进销差价', category: 'asset', side: 'credit' },
  { code: '1408', name: '委托加工物资', category: 'asset', side: 'debit' },
  { code: '1411', name: '周转材料', category: 'asset', side: 'debit' },
  { code: '1511', name: '长期股权投资', category: 'asset', side: 'debit' },
  { code: '1521', name: '投资性房地产', category: 'asset', side: 'debit' },
  { code: '1601', name: '固定资产', category: 'asset', side: 'debit' },
  { code: '1602', name: '累计折旧', category: 'asset', side: 'credit' },
  { code: '1603', name: '固定资产减值准备', category: 'asset', side: 'credit' },
  { code: '1604', name: '在建工程', category: 'asset', side: 'debit' },
  { code: '1605', name: '工程物资', category: 'asset', side: 'debit' },
  { code: '1606', name: '固定资产清理', category: 'asset', side: 'debit' },
  { code: '1701', name: '无形资产', category: 'asset', side: 'debit' },
  { code: '1702', name: '累计摊销', category: 'asset', side: 'credit' },
  { code: '1711', name: '商誉', category: 'asset', side: 'debit' },
  { code: '1801', name: '长期待摊费用', category: 'asset', side: 'debit' },
  { code: '1811', name: '递延所得税资产', category: 'asset', side: 'debit' },
  { code: '1901', name: '待处理财产损溢', category: 'asset', side: 'debit' },

  // ---------- 负债类 ----------
  { code: '2001', name: '短期借款', category: 'liability', side: 'credit' },
  { code: '2201', name: '应付票据', category: 'liability', side: 'credit' },
  { code: '2202', name: '应付账款', category: 'liability', side: 'credit', aux: ['supplier'] },
  { code: '2203', name: '预收账款', category: 'liability', side: 'credit', aux: ['customer'] },
  {
    code: '2211',
    name: '应付职工薪酬',
    category: 'liability',
    side: 'credit',
    children: [
      { code: '221101', name: '工资', category: 'liability', side: 'credit' },
      { code: '221102', name: '社会保险费', category: 'liability', side: 'credit' },
      { code: '221103', name: '住房公积金', category: 'liability', side: 'credit' },
      { code: '221104', name: '职工福利费', category: 'liability', side: 'credit' },
      { code: '221105', name: '工会经费', category: 'liability', side: 'credit' },
      { code: '221106', name: '职工教育经费', category: 'liability', side: 'credit' },
    ],
  },
  {
    code: '2221',
    name: '应交税费',
    category: 'liability',
    side: 'credit',
    children: [
      { code: '222101', name: '应交增值税', category: 'liability', side: 'credit', children: [
        { code: '22210101', name: '进项税额', category: 'liability', side: 'debit' },
        { code: '22210102', name: '销项税额', category: 'liability', side: 'credit' },
        { code: '22210103', name: '已交税金', category: 'liability', side: 'debit' },
        { code: '22210104', name: '转出未交增值税', category: 'liability', side: 'debit' },
        { code: '22210105', name: '进项税额转出', category: 'liability', side: 'credit' },
      ] },
      { code: '222102', name: '未交增值税', category: 'liability', side: 'credit' },
      { code: '222103', name: '应交消费税', category: 'liability', side: 'credit' },
      { code: '222104', name: '应交企业所得税', category: 'liability', side: 'credit' },
      { code: '222105', name: '应交城市维护建设税', category: 'liability', side: 'credit' },
      { code: '222106', name: '应交教育费附加', category: 'liability', side: 'credit' },
      { code: '222107', name: '应交地方教育附加', category: 'liability', side: 'credit' },
      { code: '222108', name: '应交个人所得税', category: 'liability', side: 'credit' },
      { code: '222109', name: '应交印花税', category: 'liability', side: 'credit' },
    ],
  },
  { code: '2231', name: '应付利息', category: 'liability', side: 'credit' },
  { code: '2232', name: '应付股利', category: 'liability', side: 'credit' },
  { code: '2241', name: '其他应付款', category: 'liability', side: 'credit', aux: ['employee', 'supplier'] },
  { code: '2501', name: '长期借款', category: 'liability', side: 'credit' },
  { code: '2701', name: '长期应付款', category: 'liability', side: 'credit' },
  { code: '2801', name: '预计负债', category: 'liability', side: 'credit' },
  { code: '2901', name: '递延所得税负债', category: 'liability', side: 'credit' },

  // ---------- 权益类 ----------
  { code: '4001', name: '实收资本', category: 'equity', side: 'credit' },
  { code: '4002', name: '资本公积', category: 'equity', side: 'credit' },
  { code: '4101', name: '盈余公积', category: 'equity', side: 'credit' },
  { code: '4103', name: '本年利润', category: 'equity', side: 'credit' },
  { code: '4104', name: '利润分配', category: 'equity', side: 'credit' },
  { code: '4201', name: '库存股', category: 'equity', side: 'debit' },

  // ---------- 成本类 ----------
  { code: '5001', name: '生产成本', category: 'cost', side: 'debit' },
  { code: '5101', name: '制造费用', category: 'cost', side: 'debit' },
  { code: '5201', name: '劳务成本', category: 'cost', side: 'debit' },
  { code: '5301', name: '研发支出', category: 'cost', side: 'debit' },

  // ---------- 损益类 ----------
  { code: '6001', name: '主营业务收入', category: 'pnl', side: 'credit' },
  { code: '6051', name: '其他业务收入', category: 'pnl', side: 'credit' },
  { code: '6101', name: '公允价值变动损益', category: 'pnl', side: 'credit' },
  { code: '6111', name: '投资收益', category: 'pnl', side: 'credit' },
  { code: '6115', name: '资产处置损益', category: 'pnl', side: 'credit' },
  { code: '6117', name: '其他收益', category: 'pnl', side: 'credit' },
  { code: '6301', name: '营业外收入', category: 'pnl', side: 'credit' },
  { code: '6401', name: '主营业务成本', category: 'pnl', side: 'debit' },
  { code: '6402', name: '其他业务成本', category: 'pnl', side: 'debit' },
  { code: '6403', name: '税金及附加', category: 'pnl', side: 'debit' },
  {
    code: '6601',
    name: '销售费用',
    category: 'pnl',
    side: 'debit',
    children: [
      { code: '660101', name: '职工薪酬', category: 'pnl', side: 'debit' },
      { code: '660102', name: '办公费', category: 'pnl', side: 'debit' },
      { code: '660103', name: '差旅费', category: 'pnl', side: 'debit' },
      { code: '660104', name: '业务招待费', category: 'pnl', side: 'debit' },
      { code: '660105', name: '广告宣传费', category: 'pnl', side: 'debit' },
      { code: '660106', name: '运输费', category: 'pnl', side: 'debit' },
      { code: '660107', name: '折旧费', category: 'pnl', side: 'debit' },
    ],
  },
  {
    code: '6602',
    name: '管理费用',
    category: 'pnl',
    side: 'debit',
    children: [
      { code: '660201', name: '职工薪酬', category: 'pnl', side: 'debit' },
      { code: '660202', name: '办公费', category: 'pnl', side: 'debit' },
      { code: '660203', name: '差旅费', category: 'pnl', side: 'debit' },
      { code: '660204', name: '业务招待费', category: 'pnl', side: 'debit' },
      { code: '660205', name: '折旧费', category: 'pnl', side: 'debit' },
      { code: '660206', name: '水电费', category: 'pnl', side: 'debit' },
      { code: '660207', name: '通讯费', category: 'pnl', side: 'debit' },
      { code: '660208', name: '咨询费', category: 'pnl', side: 'debit' },
      { code: '660209', name: '租赁费', category: 'pnl', side: 'debit' },
      { code: '660210', name: '保险费', category: 'pnl', side: 'debit' },
    ],
  },
  {
    code: '6603',
    name: '财务费用',
    category: 'pnl',
    side: 'debit',
    children: [
      { code: '660301', name: '利息费用', category: 'pnl', side: 'debit' },
      { code: '660302', name: '手续费', category: 'pnl', side: 'debit' },
      { code: '660303', name: '汇兑损益', category: 'pnl', side: 'debit' },
    ],
  },
  { code: '6701', name: '资产减值损失', category: 'pnl', side: 'debit' },
  { code: '6711', name: '营业外支出', category: 'pnl', side: 'debit' },
  { code: '6801', name: '所得税费用', category: 'pnl', side: 'debit' },
  { code: '6901', name: '以前年度损益调整', category: 'pnl', side: 'debit' },
];

// ============================================================
// 小企业会计准则（66 个一级科目）
// ============================================================
export const smallAccounts: SeedAccount[] = [
  // 资产类
  { code: '1001', name: '库存现金', category: 'asset', side: 'debit', aux: ['cashflow'] },
  { code: '1002', name: '银行存款', category: 'asset', side: 'debit', aux: ['cashflow'] },
  { code: '1012', name: '其他货币资金', category: 'asset', side: 'debit', aux: ['cashflow'] },
  { code: '1101', name: '短期投资', category: 'asset', side: 'debit' },
  { code: '1121', name: '应收票据', category: 'asset', side: 'debit' },
  { code: '1122', name: '应收账款', category: 'asset', side: 'debit', aux: ['customer'] },
  { code: '1123', name: '预付账款', category: 'asset', side: 'debit', aux: ['supplier'] },
  { code: '1131', name: '应收股利', category: 'asset', side: 'debit' },
  { code: '1132', name: '应收利息', category: 'asset', side: 'debit' },
  { code: '1221', name: '其他应收款', category: 'asset', side: 'debit', aux: ['employee'] },
  { code: '1401', name: '材料采购', category: 'asset', side: 'debit' },
  { code: '1402', name: '在途物资', category: 'asset', side: 'debit' },
  { code: '1403', name: '原材料', category: 'asset', side: 'debit' },
  { code: '1404', name: '材料成本差异', category: 'asset', side: 'debit' },
  { code: '1405', name: '库存商品', category: 'asset', side: 'debit' },
  { code: '1407', name: '商品进销差价', category: 'asset', side: 'credit' },
  { code: '1408', name: '委托加工物资', category: 'asset', side: 'debit' },
  { code: '1411', name: '周转材料', category: 'asset', side: 'debit' },
  { code: '1421', name: '消耗性生物资产', category: 'asset', side: 'debit' },
  { code: '1501', name: '长期债券投资', category: 'asset', side: 'debit' },
  { code: '1511', name: '长期股权投资', category: 'asset', side: 'debit' },
  { code: '1601', name: '固定资产', category: 'asset', side: 'debit' },
  { code: '1602', name: '累计折旧', category: 'asset', side: 'credit' },
  { code: '1604', name: '在建工程', category: 'asset', side: 'debit' },
  { code: '1605', name: '工程物资', category: 'asset', side: 'debit' },
  { code: '1606', name: '固定资产清理', category: 'asset', side: 'debit' },
  { code: '1621', name: '生产性生物资产', category: 'asset', side: 'debit' },
  { code: '1622', name: '生产性生物资产累计折旧', category: 'asset', side: 'credit' },
  { code: '1701', name: '无形资产', category: 'asset', side: 'debit' },
  { code: '1702', name: '累计摊销', category: 'asset', side: 'credit' },
  { code: '1801', name: '长期待摊费用', category: 'asset', side: 'debit' },
  { code: '1901', name: '待处理财产损溢', category: 'asset', side: 'debit' },

  // 负债类
  { code: '2001', name: '短期借款', category: 'liability', side: 'credit' },
  { code: '2201', name: '应付票据', category: 'liability', side: 'credit' },
  { code: '2202', name: '应付账款', category: 'liability', side: 'credit', aux: ['supplier'] },
  { code: '2203', name: '预收账款', category: 'liability', side: 'credit', aux: ['customer'] },
  { code: '2211', name: '应付职工薪酬', category: 'liability', side: 'credit' },
  { code: '2221', name: '应交税费', category: 'liability', side: 'credit' },
  { code: '2231', name: '应付利息', category: 'liability', side: 'credit' },
  { code: '2232', name: '应付利润', category: 'liability', side: 'credit' },
  { code: '2241', name: '其他应付款', category: 'liability', side: 'credit', aux: ['employee'] },
  { code: '2401', name: '递延收益', category: 'liability', side: 'credit' },
  { code: '2501', name: '长期借款', category: 'liability', side: 'credit' },
  { code: '2701', name: '长期应付款', category: 'liability', side: 'credit' },

  // 所有者权益类
  { code: '3001', name: '实收资本', category: 'equity', side: 'credit' },
  { code: '3002', name: '资本公积', category: 'equity', side: 'credit' },
  { code: '3101', name: '盈余公积', category: 'equity', side: 'credit' },
  { code: '3103', name: '本年利润', category: 'equity', side: 'credit' },
  { code: '3104', name: '利润分配', category: 'equity', side: 'credit' },

  // 成本类
  { code: '4001', name: '生产成本', category: 'cost', side: 'debit' },
  { code: '4101', name: '制造费用', category: 'cost', side: 'debit' },
  { code: '4301', name: '研发支出', category: 'cost', side: 'debit' },
  { code: '4401', name: '工程施工', category: 'cost', side: 'debit' },
  { code: '4403', name: '机械作业', category: 'cost', side: 'debit' },

  // 损益类
  { code: '5001', name: '主营业务收入', category: 'pnl', side: 'credit' },
  { code: '5051', name: '其他业务收入', category: 'pnl', side: 'credit' },
  { code: '5111', name: '投资收益', category: 'pnl', side: 'credit' },
  { code: '5301', name: '营业外收入', category: 'pnl', side: 'credit' },
  { code: '5401', name: '主营业务成本', category: 'pnl', side: 'debit' },
  { code: '5402', name: '其他业务成本', category: 'pnl', side: 'debit' },
  { code: '5403', name: '税金及附加', category: 'pnl', side: 'debit' },
  { code: '5601', name: '销售费用', category: 'pnl', side: 'debit' },
  { code: '5602', name: '管理费用', category: 'pnl', side: 'debit' },
  { code: '5603', name: '财务费用', category: 'pnl', side: 'debit' },
  { code: '5711', name: '营业外支出', category: 'pnl', side: 'debit' },
  { code: '5801', name: '所得税费用', category: 'pnl', side: 'debit' },
];

// 默认现金流量项目
export const defaultCashFlowItems: { code: string; name: string; category: string }[] = [
  { code: '01', name: '销售商品、提供劳务收到的现金', category: 'operating' },
  { code: '02', name: '收到其他与经营活动有关的现金', category: 'operating' },
  { code: '03', name: '购买商品、接受劳务支付的现金', category: 'operating' },
  { code: '04', name: '支付给职工以及为职工支付的现金', category: 'operating' },
  { code: '05', name: '支付的各项税费', category: 'operating' },
  { code: '06', name: '支付其他与经营活动有关的现金', category: 'operating' },
  { code: '07', name: '收回投资收到的现金', category: 'investing' },
  { code: '08', name: '取得投资收益收到的现金', category: 'investing' },
  { code: '09', name: '购建固定资产、无形资产支付的现金', category: 'investing' },
  { code: '10', name: '取得借款收到的现金', category: 'financing' },
  { code: '11', name: '偿还债务支付的现金', category: 'financing' },
  { code: '12', name: '分配股利、利润或偿付利息支付的现金', category: 'financing' },
];
