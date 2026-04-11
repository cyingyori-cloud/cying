export type AppRole = 'executive' | 'sales' | 'presales' | 'product' | 'approver';

export interface RoleViewMeta {
  id: AppRole;
  label: string;
  shortLabel: string;
  description: string;
  focus: string;
  defaultTab: string;
  allowedTabs: string[];
}

export const roleViews: RoleViewMeta[] = [
  {
    id: 'executive',
    label: '老板/管理层',
    shortLabel: '老板',
    description: '重点看报价效率、毛利率、待审批金额和重点项目推进。',
    focus: '经营结果',
    defaultTab: 'dashboard',
    allowedTabs: ['dashboard', 'inquiry-matching', 'mapping-workbench', 'quotations-list'],
  },
  {
    id: 'sales',
    label: '销售',
    shortLabel: '销售',
    description: '重点看商机任务、快速选型、报价状态和客户可输出摘要。',
    focus: '成交推进',
    defaultTab: 'inquiry-matching',
    allowedTabs: ['dashboard', 'inquiry-matching', 'configurator-forward', 'configurator-reverse', 'quotations-list', 'quotations-cpq'],
  },
  {
    id: 'presales',
    label: '售前/方案经理',
    shortLabel: '售前',
    description: '重点看配置能力、规则冲突、认证口径、多方案对比和成本拆解。',
    focus: '方案设计',
    defaultTab: 'inquiry-matching',
    allowedTabs: ['dashboard', 'inquiry-matching', 'products-catalog', 'products-models', 'products-bom', 'features', 'rules', 'configurator-forward', 'configurator-reverse', 'quotations-list', 'quotations-cpq'],
  },
  {
    id: 'product',
    label: '产品/解决方案负责人',
    shortLabel: '产品',
    description: '重点看型号主数据、特征配置、规则引擎与产品线覆盖。',
    focus: '产品治理',
    defaultTab: 'mapping-workbench',
    allowedTabs: ['dashboard', 'mapping-workbench', 'products-catalog', 'products-models', 'products-bom', 'features', 'rules', 'quotations-list'],
  },
  {
    id: 'approver',
    label: '审批人/经营管理',
    shortLabel: '审批',
    description: '重点看待审批报价、毛利率异常、风险原因和审批建议。',
    focus: '风险控制',
    defaultTab: 'approval-workbench',
    allowedTabs: ['dashboard', 'approval-workbench', 'mapping-workbench', 'quotations-list'],
  },
];

export const roleViewMap = Object.fromEntries(roleViews.map((role) => [role.id, role])) as Record<AppRole, RoleViewMeta>;
