import React from 'react';
import {
  LayoutDashboard, Package, Settings, FileText,
  Zap, GitBranch, ChevronRight, Boxes, ShieldAlert, BriefcaseBusiness, ClipboardList, Workflow,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { roleViewMap } from '../../data/roleViews';
import { useAppStore } from '../../store/appStore';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: '总览仪表盘',
    icon: <LayoutDashboard size={18} />,
  },
  {
    id: 'approval-workbench',
    label: '审批工作台',
    icon: <ShieldAlert size={18} />,
    badge: '审批',
  },
  {
    id: 'inquiry-matching',
    label: '需求录入与匹配',
    icon: <ClipboardList size={18} />,
    badge: 'P0',
  },
  {
    id: 'mapping-workbench',
    label: '映射与成本协同',
    icon: <Workflow size={18} />,
    badge: 'P0',
  },
  {
    id: 'products',
    label: '产品主数据',
    icon: <Package size={18} />,
    children: [
      { id: 'products-catalog', label: '产品目录', icon: <Boxes size={16} /> },
      { id: 'products-models', label: '产品型号', icon: <Package size={16} /> },
      { id: 'products-bom', label: 'BOM物料清单', icon: <GitBranch size={16} /> },
    ],
  },
  {
    id: 'features',
    label: '特征与配置表',
    icon: <Settings size={18} />,
  },
  {
    id: 'rules',
    label: '选配规则引擎',
    icon: <GitBranch size={18} />,
    badge: '规则',
  },
  {
    id: 'configurator',
    label: '智能选配器',
    icon: <Zap size={18} />,
    children: [
      { id: 'configurator-forward', label: '正向选配', icon: <ChevronRight size={16} /> },
      { id: 'configurator-reverse', label: '反向选配 (AI)', icon: <Zap size={16} /> },
    ],
  },
  {
    id: 'quotations',
    label: '报价管理',
    icon: <FileText size={18} />,
    children: [
      { id: 'quotations-list', label: '报价单列表', icon: <FileText size={16} /> },
      { id: 'quotations-cpq', label: 'CPQ报价', icon: <ChevronRight size={16} /> },
    ],
  },
];

function filterNavItems(items: NavItem[], allowedTabs: string[]): NavItem[] {
  return items.flatMap((item) => {
    if (item.children) {
      const visibleChildren = item.children.filter((child) => allowedTabs.includes(child.id));
      return visibleChildren.length > 0 ? [{ ...item, children: visibleChildren }] : [];
    }
    return allowedTabs.includes(item.id) ? [item] : [];
  });
}

function NavItemComponent({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const { activeTab, setActiveTab } = useAppStore();
  const [expanded, setExpanded] = React.useState(() => {
    if (item.children) return item.children.some((child) => child.id === activeTab) || item.id === activeTab;
    return false;
  });

  React.useEffect(() => {
    if (item.children) {
      setExpanded(item.children.some((child) => child.id === activeTab) || item.id === activeTab);
    }
  }, [activeTab, item]);

  const isActive = activeTab === item.id;
  const hasChildren = Boolean(item.children?.length);

  const handleClick = () => {
    if (hasChildren) setExpanded(!expanded);
    else setActiveTab(item.id);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
          depth > 0 && 'pl-8 text-xs',
          isActive
            ? 'bg-brand-600 text-white shadow-sm shadow-brand-200'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )}
      >
        <span className={cn(isActive ? 'text-white' : 'text-slate-400')}>{item.icon}</span>
        <span className="flex-1 text-left">{item.label}</span>
        {item.badge && (
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
            isActive ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-600',
          )}>
            {item.badge}
          </span>
        )}
        {hasChildren && (
          <ChevronRight size={14} className={cn(
            'transition-transform duration-200',
            expanded ? 'rotate-90' : '',
            isActive ? 'text-white' : 'text-slate-400',
          )} />
        )}
      </button>
      {hasChildren && expanded && (
        <div className="mt-1 space-y-0.5 ml-2 pl-2 border-l border-slate-100">
          {item.children!.map((child) => (
            <NavItemComponent key={child.id} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { currentRole } = useAppStore();
  const roleInfo = roleViewMap[currentRole];
  const visibleNavItems = filterNavItems(navItems, roleInfo.allowedTabs);
  const roleIcon = currentRole === 'sales' ? <BriefcaseBusiness size={16} className="text-brand-500" />
    : currentRole === 'approver' ? <ShieldAlert size={16} className="text-brand-500" />
      : currentRole === 'product' ? <Boxes size={16} className="text-brand-500" />
        : currentRole === 'presales' ? <Zap size={16} className="text-brand-500" />
          : <LayoutDashboard size={16} className="text-brand-500" />;

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0">
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm shadow-brand-200">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">PowerQuote AI</p>
            <p className="text-[10px] text-slate-400">储能业务 CPQ</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-brand-50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            {roleIcon}
            <p className="text-xs font-semibold text-brand-700">{roleInfo.label}</p>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{roleInfo.focus}</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => (
          <NavItemComponent key={item.id} item={item} />
        ))}
      </nav>

      <div className="px-4 pb-4 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{roleInfo.shortLabel.slice(0, 1)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{roleInfo.label}</p>
            <p className="text-xs text-slate-400 truncate">demo@powerquote.ai</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
