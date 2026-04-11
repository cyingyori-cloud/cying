import { Bell, Search, HelpCircle } from 'lucide-react';
import { roleViewMap, roleViews } from '../../data/roleViews';
import { useAppStore } from '../../store/appStore';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: '总览仪表盘', subtitle: '按角色切换系统视角，演示管理、销售、售前、产品与审批协同' },
  'approval-workbench': { title: '审批工作台', subtitle: '聚焦待审批报价、毛利率异常、审批建议与处理动作' },
  'inquiry-matching': { title: '需求录入与候选匹配', subtitle: '从客户需求参数出发生成多候选方案、软预警与下一步报价建议' },
  'mapping-workbench': { title: '映射与成本协同', subtitle: '销售产品转内部物料/BOM，并驱动采购、财务与成本协同补齐' },
  'products-catalog': { title: '产品目录', subtitle: '管理新能安储能产品线与目录层级' },
  'products-models': { title: '产品型号', subtitle: '管理公开产品参数、估算成本与演示报价基线' },
  'products-bom': { title: 'BOM物料清单', subtitle: '查看演示级 BOM 与成本拆解结构' },
  features: { title: '特征与配置表', subtitle: '管理储能交付口径、场景策略与认证选项' },
  rules: { title: '选配规则引擎', subtitle: '管理储能项目的并机、安全与区域交付规则' },
  'configurator-forward': { title: '正向选配', subtitle: '手动选型并实时校验储能 CPQ 规则' },
  'configurator-reverse': { title: 'AI反向选配', subtitle: '按预算与偏好自动生成可行储能配置方案' },
  'quotations-list': { title: '报价单管理', subtitle: '查看来自纷享销客商机的 CPQ 报价与审批状态' },
  'quotations-cpq': { title: 'CPQ报价', subtitle: '基于配置结果生成储能业务报价单' },
};

interface TopBarProps {
  activeTab: string;
}

export function TopBar({ activeTab }: TopBarProps) {
  const info = pageTitles[activeTab] ?? { title: '页面', subtitle: '' };
  const { currentRole, setCurrentRole, setActiveTab } = useAppStore();
  const roleInfo = roleViewMap[currentRole];
  const searchPlaceholder = currentRole === 'executive'
    ? '搜索重点项目、报价单、商机号...'
    : currentRole === 'sales'
      ? '搜索客户、商机号、报价单...'
      : currentRole === 'presales'
        ? '搜索型号、规则、认证口径...'
        : currentRole === 'product'
          ? '搜索型号、特征、规则...'
          : '搜索待审批项目、异常报价...';

  return (
    <header className="bg-white border-b border-slate-100 px-6 py-3 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">{info.title}</h1>
            <span className="hidden lg:inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
              当前视角：{roleInfo.label}
            </span>
          </div>
          {info.subtitle && <p className="text-xs text-slate-400">{info.subtitle}</p>}
        </div>

        <div className="hidden xl:flex items-center gap-1 rounded-2xl bg-slate-100 p-1">
          {roleViews.map((role) => (
            <button
              key={role.id}
              onClick={() => {
                setCurrentRole(role.id);
                setActiveTab(role.defaultTab);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                currentRole === role.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {role.shortLabel}
            </button>
          ))}
        </div>

        <div className="relative hidden md:flex items-center">
          <Search size={14} className="absolute left-3 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 w-64 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <button className="relative p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full" />
          </button>
          <button className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <HelpCircle size={18} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 xl:hidden">
        <div className="flex flex-wrap gap-2">
          {roleViews.map((role) => (
            <button
              key={role.id}
              onClick={() => {
                setCurrentRole(role.id);
                setActiveTab(role.defaultTab);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                currentRole === role.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">{roleInfo.description}</p>
      </div>
    </header>
  );
}
