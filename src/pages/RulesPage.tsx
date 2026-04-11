import { useState } from 'react';
import { GitBranch, Plus, Eye, ToggleLeft, ToggleRight, AlertTriangle, Link, Ban, Star } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { mockRules, mockFeatures, mockOptions } from '../data/mockData';
import type { ConfigRule, RuleType } from '../types';

const ruleTypeConfig: Record<RuleType, { label: string; variant: 'danger' | 'warning' | 'info' | 'purple'; icon: React.ReactNode; desc: string }> = {
  DEPENDENCY: { label: '依赖规则', variant: 'info', icon: <Link size={14} />, desc: '当条件满足时，动作项必须被选择' },
  EXCLUSION: { label: '互斥规则', variant: 'danger', icon: <Ban size={14} />, desc: '当条件满足时，动作项被禁止选择' },
  FORCE: { label: '强制规则', variant: 'warning', icon: <AlertTriangle size={14} />, desc: '强制某特征必须选择指定选项' },
  RECOMMEND: { label: '推荐规则', variant: 'purple', icon: <Star size={14} />, desc: '非强制性建议，不阻断配置' },
};

function getFeatureName(id: number) {
  return mockFeatures.find((f) => f.id === id)?.featureName ?? `特征#${id}`;
}

function getOptionName(id?: number) {
  if (!id) return '任意选项';
  return mockOptions.find((o) => o.id === id)?.optionName ?? `选项#${id}`;
}

interface RuleCardProps {
  rule: ConfigRule;
  onView: (rule: ConfigRule) => void;
}

function RuleCard({ rule, onView }: RuleCardProps) {
  const [active, setActive] = useState(rule.isActive);
  const typeConf = ruleTypeConfig[rule.ruleType];
  const conditions = rule.items?.filter((i) => i.itemRole === 'CONDITION') ?? [];
  const actions = rule.items?.filter((i) => i.itemRole === 'ACTION') ?? [];

  return (
    <Card hover className="overflow-hidden">
      <div className={`h-1 w-full ${
        rule.ruleType === 'DEPENDENCY' ? 'bg-blue-400'
          : rule.ruleType === 'EXCLUSION' ? 'bg-red-400'
            : rule.ruleType === 'FORCE' ? 'bg-amber-400'
              : 'bg-purple-400'
      }`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={typeConf.variant}>
                <span className="flex items-center gap-1">{typeConf.icon}{typeConf.label}</span>
              </Badge>
              <span className="text-xs text-slate-400 font-mono">{rule.ruleCode}</span>
              <span className="text-xs text-slate-400">优先级: {rule.priority}</span>
            </div>
            <h3 className="mt-2 font-semibold text-slate-900">{rule.ruleName}</h3>
            {rule.description && (
              <p className="mt-1 text-xs text-slate-500">{rule.description}</p>
            )}
          </div>
          <button
            onClick={() => setActive(!active)}
            className={`mt-1 ${active ? 'text-emerald-500' : 'text-slate-300'} hover:scale-110 transition-transform`}
            title={active ? '点击禁用' : '点击启用'}
          >
            {active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
          </button>
        </div>

        {/* Logic Display */}
        <div className="mt-4 bg-slate-50 rounded-xl p-3 text-xs space-y-2">
          <div>
            <span className="text-slate-400 font-medium">IF </span>
            {conditions.map((c, idx) => (
              <span key={c.id}>
                {idx > 0 && <span className="text-slate-400"> AND </span>}
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">
                  {getFeatureName(c.featureId)} = {getOptionName(c.featureOptionId)}
                </span>
              </span>
            ))}
          </div>
          <div>
            <span className={`font-medium ${
              rule.ruleType === 'EXCLUSION' ? 'text-red-500'
                : rule.ruleType === 'DEPENDENCY' ? 'text-blue-600'
                  : rule.ruleType === 'FORCE' ? 'text-amber-600'
                    : 'text-purple-600'
            }`}>
              {rule.ruleType === 'EXCLUSION' ? 'THEN EXCLUDE '
                : rule.ruleType === 'DEPENDENCY' ? 'THEN REQUIRE '
                  : rule.ruleType === 'FORCE' ? 'THEN FORCE '
                    : 'THEN RECOMMEND '}
            </span>
            {actions.map((a, idx) => (
              <span key={a.id}>
                {idx > 0 && <span className="text-slate-400"> AND </span>}
                <span className={`px-1.5 py-0.5 rounded-md ${
                  rule.ruleType === 'EXCLUSION' ? 'bg-red-100 text-red-700'
                    : rule.ruleType === 'DEPENDENCY' ? 'bg-blue-100 text-blue-700'
                      : rule.ruleType === 'FORCE' ? 'bg-amber-100 text-amber-700'
                        : 'bg-purple-100 text-purple-700'
                }`}>
                  {getFeatureName(a.featureId)} = {getOptionName(a.featureOptionId)}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Badge variant={active ? 'success' : 'default'}>{active ? '已启用' : '已禁用'}</Badge>
          <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => onView(rule)}>
            详情
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function RulesPage() {
  const [viewRule, setViewRule] = useState<ConfigRule | null>(null);
  const [filter, setFilter] = useState<string>('ALL');

  const filtered = mockRules.filter((r) => filter === 'ALL' || r.ruleType === filter);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {(['ALL', 'DEPENDENCY', 'EXCLUSION', 'FORCE', 'RECOMMEND'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                filter === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {type === 'ALL' ? '全部' : ruleTypeConfig[type].label}
            </button>
          ))}
        </div>
        <Button icon={<Plus size={16} />} size="sm">新建规则</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['DEPENDENCY', 'EXCLUSION', 'FORCE', 'RECOMMEND'] as RuleType[]).map((type) => {
          const count = mockRules.filter((r) => r.ruleType === type).length;
          const conf = ruleTypeConfig[type];
          return (
            <Card key={type} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`${
                  type === 'DEPENDENCY' ? 'text-blue-500'
                    : type === 'EXCLUSION' ? 'text-red-500'
                      : type === 'FORCE' ? 'text-amber-500'
                        : 'text-purple-500'
                }`}>{conf.icon}</span>
                <span className="text-sm font-medium text-slate-700">{conf.label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{conf.desc}</p>
            </Card>
          );
        })}
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((rule) => (
          <RuleCard key={rule.id} rule={rule} onView={setViewRule} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="py-16 text-center text-slate-400">
          <GitBranch size={40} className="mx-auto mb-3 opacity-30" />
          <p>暂无此类型规则</p>
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!viewRule} onClose={() => setViewRule(null)} title="规则详情" size="lg">
        {viewRule && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={ruleTypeConfig[viewRule.ruleType].variant}>
                {ruleTypeConfig[viewRule.ruleType].label}
              </Badge>
              <span className="text-sm font-mono text-slate-500">{viewRule.ruleCode}</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900">{viewRule.ruleName}</h3>
            {viewRule.description && (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4">{viewRule.description}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-1">规则优先级</p>
                <p className="font-bold text-slate-900">{viewRule.priority}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-1">当前状态</p>
                <Badge variant={viewRule.isActive ? 'success' : 'default'}>
                  {viewRule.isActive ? '已启用' : '已禁用'}
                </Badge>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">规则条件项 (IF)</h4>
              <div className="space-y-2">
                {viewRule.items?.filter((i) => i.itemRole === 'CONDITION').map((item) => (
                  <div key={item.id} className="flex items-center gap-2 bg-blue-50 rounded-xl px-4 py-2.5 text-sm">
                    <span className="text-blue-500 font-mono text-xs">COND</span>
                    <span className="font-medium text-slate-700">{getFeatureName(item.featureId)}</span>
                    <span className="text-slate-400">{item.operator}</span>
                    <span className="font-medium text-blue-700">{getOptionName(item.featureOptionId)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">规则动作项 (THEN)</h4>
              <div className="space-y-2">
                {viewRule.items?.filter((i) => i.itemRole === 'ACTION').map((item) => (
                  <div key={item.id} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${
                    viewRule.ruleType === 'EXCLUSION' ? 'bg-red-50'
                      : viewRule.ruleType === 'RECOMMEND' ? 'bg-purple-50'
                        : 'bg-amber-50'
                  }`}>
                    <span className={`font-mono text-xs ${
                      viewRule.ruleType === 'EXCLUSION' ? 'text-red-500'
                        : viewRule.ruleType === 'RECOMMEND' ? 'text-purple-500'
                          : 'text-amber-500'
                    }`}>ACT</span>
                    <span className="font-medium text-slate-700">{getFeatureName(item.featureId)}</span>
                    <span className="text-slate-400">→</span>
                    <span className={`font-medium ${
                      viewRule.ruleType === 'EXCLUSION' ? 'text-red-700'
                        : viewRule.ruleType === 'RECOMMEND' ? 'text-purple-700'
                          : 'text-amber-700'
                    }`}>{getOptionName(item.featureOptionId)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
