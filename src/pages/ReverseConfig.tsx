import { useState } from 'react';
import {
  Zap, Target, Star, DollarSign, TrendingUp,
  ChevronRight, CheckCircle, ShoppingCart, Cpu, Shield, Sparkles, Link2,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  demoDataNotice, mockModels, mockFeatures, mockOptions, mockProductFeatureRels, mockRules,
} from '../data/mockData';
import { roleViewMap } from '../data/roleViews';
import { useAppStore } from '../store/appStore';
import type { ConfigScheme } from '../types';

function generateSchemes(
  productId: number,
  minBudget: number,
  maxBudget: number,
  perfWeight: number,
): ConfigScheme[] {
  const product = mockModels.find((model) => model.id === productId);
  if (!product) return [];

  const relations = mockProductFeatureRels.filter((relation) => relation.productModelId === productId);
  const featureIds = relations.map((relation) => relation.featureId);
  const optionsByFeature: Record<number, typeof mockOptions> = {};

  featureIds.forEach((featureId) => {
    optionsByFeature[featureId] = mockOptions.filter((option) => option.featureId === featureId && option.status === 'ACTIVE');
  });

  type Combo = Record<number, (typeof mockOptions)[0]>;
  const validCombos: Combo[] = [];

  function backtrack(index: number, current: Combo) {
    if (validCombos.length >= 50) return;

    if (index === featureIds.length) {
      const totalPrice = featureIds.reduce((sum, featureId) => sum + (current[featureId]?.priceImpact ?? 0), product.basePrice);
      if (totalPrice < minBudget || totalPrice > maxBudget) return;

      const selectedOptions: Record<number, number> = {};
      featureIds.forEach((featureId) => {
        if (current[featureId]) selectedOptions[featureId] = current[featureId].id;
      });

      for (const rule of mockRules.filter((item) => item.isActive && (!item.productModelId || item.productModelId === productId))) {
        const conditions = rule.items?.filter((item) => item.itemRole === 'CONDITION') ?? [];
        const actions = rule.items?.filter((item) => item.itemRole === 'ACTION') ?? [];
        const conditionsMet = conditions.every((condition) => selectedOptions[condition.featureId] === condition.featureOptionId);

        if (!conditionsMet) continue;

        if (rule.ruleType === 'EXCLUSION' && actions.some((action) => selectedOptions[action.featureId] === action.featureOptionId)) return;
        if (rule.ruleType === 'DEPENDENCY' && actions.some((action) => selectedOptions[action.featureId] !== action.featureOptionId)) return;
      }

      validCombos.push({ ...current });
      return;
    }

    const featureId = featureIds[index];
    for (const option of optionsByFeature[featureId] ?? []) {
      current[featureId] = option;
      backtrack(index + 1, current);
      if (validCombos.length >= 50) return;
    }
  }

  backtrack(0, {});

  const scored = validCombos.map((combo) => {
    const totalCost = featureIds.reduce((sum, featureId) => sum + (combo[featureId]?.cost ?? 0), product.baseCost ?? 0);
    const totalPrice = featureIds.reduce((sum, featureId) => sum + (combo[featureId]?.priceImpact ?? 0), product.basePrice);
    const performanceScore = featureIds.reduce((sum, featureId) => sum + (combo[featureId]?.performanceScore ?? 0), 0) / featureIds.length;
    const marginScore = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;
    const weightedScore = performanceScore * perfWeight + marginScore * 100 * (1 - perfWeight);

    const configDetail: Record<number, number> = {};
    const configReadable: Record<string, string> = {};

    featureIds.forEach((featureId) => {
      if (combo[featureId]) {
        configDetail[featureId] = combo[featureId].id;
        const feature = mockFeatures.find((item) => item.id === featureId);
        configReadable[feature?.featureName ?? `特征${featureId}`] = combo[featureId].optionName;
      }
    });

    return {
      schemeName: '',
      schemeTag: 'ALTERNATIVE' as const,
      configDetail,
      configReadable,
      totalCost,
      totalPrice,
      performanceScore: Math.round(performanceScore * 100) / 100,
      costEfficiencyScore: Math.round(weightedScore * 100) / 100,
    };
  });

  if (scored.length === 0) return [];

  const highPerformance = [...scored].sort((a, b) => b.performanceScore - a.performanceScore)[0];
  const balanced = [...scored].filter((scheme) => scheme !== highPerformance).sort((a, b) => b.costEfficiencyScore - a.costEfficiencyScore)[0];
  const costEffective = [...scored].filter((scheme) => scheme !== highPerformance && scheme !== balanced).sort((a, b) => a.totalPrice - b.totalPrice)[0];

  const result: ConfigScheme[] = [];
  if (highPerformance) result.push({ ...highPerformance, schemeName: '性能优先方案', schemeTag: 'HIGH_PERFORMANCE' });
  if (balanced) result.push({ ...balanced, schemeName: '均衡推荐方案', schemeTag: 'BALANCED' });
  if (costEffective) result.push({ ...costEffective, schemeName: '经济优选方案', schemeTag: 'COST_EFFECTIVE' });

  return result;
}

const schemeConfig = {
  HIGH_PERFORMANCE: {
    label: '性能优先',
    icon: <Cpu size={18} className="text-purple-600" />,
    bg: 'from-purple-500 to-purple-700',
    badge: 'purple' as const,
    accent: 'text-purple-600',
    border: 'border-purple-200',
    highlight: 'bg-purple-50',
  },
  BALANCED: {
    label: '均衡推荐',
    icon: <Shield size={18} className="text-blue-600" />,
    bg: 'from-blue-500 to-blue-700',
    badge: 'info' as const,
    accent: 'text-blue-600',
    border: 'border-blue-200',
    highlight: 'bg-blue-50',
  },
  COST_EFFECTIVE: {
    label: '经济优选',
    icon: <DollarSign size={18} className="text-emerald-600" />,
    bg: 'from-emerald-500 to-emerald-700',
    badge: 'success' as const,
    accent: 'text-emerald-600',
    border: 'border-emerald-200',
    highlight: 'bg-emerald-50',
  },
  ALTERNATIVE: {
    label: '备选方案',
    icon: <Star size={18} className="text-amber-600" />,
    bg: 'from-amber-500 to-amber-700',
    badge: 'warning' as const,
    accent: 'text-amber-600',
    border: 'border-amber-200',
    highlight: 'bg-amber-50',
  },
};

function SchemeCard({ scheme, onSelect }: { scheme: ConfigScheme; onSelect: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const config = schemeConfig[scheme.schemeTag];

  return (
    <Card className={`overflow-hidden border-2 ${config.border}`}>
      <div className={`bg-gradient-to-r ${config.bg} p-5 text-white`}>
        <div className="flex items-center justify-between mb-3">
          <div className="bg-white/20 rounded-xl p-2">{config.icon}</div>
          <Badge variant={config.badge} className="bg-white/20 text-white border-white/30">{config.label}</Badge>
        </div>
        <h3 className="text-lg font-bold">{scheme.schemeName}</h3>
        <p className="text-4xl font-bold mt-2">¥{scheme.totalPrice.toLocaleString()}</p>
        <p className="text-white/70 text-xs mt-1">成本: ¥{scheme.totalCost.toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-1">
            <TrendingUp size={12} /> 性能评分
          </div>
          <p className="text-xl font-bold text-slate-900">{scheme.performanceScore.toFixed(1)}</p>
          <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: `${scheme.performanceScore}%` }} />
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-1">
            <Star size={12} /> 综合评分
          </div>
          <p className="text-xl font-bold text-slate-900">{scheme.costEfficiencyScore.toFixed(1)}</p>
          <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" style={{ width: `${Math.min(scheme.costEfficiencyScore, 100)}%` }} />
          </div>
        </div>
      </div>

      <CardBody>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-3 font-medium"
        >
          {expanded ? '收起配置详情' : '展开配置详情'}
          <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        {expanded && (
          <div className="space-y-1.5 mb-3">
            {Object.entries(scheme.configReadable).map(([feature, option]) => (
              <div key={feature} className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${config.highlight}`}>
                <span className="text-slate-600">{feature}</span>
                <span className={`font-medium ${config.accent}`}>{option}</span>
              </div>
            ))}
          </div>
        )}
        <Button className="w-full" onClick={onSelect} icon={<ShoppingCart size={15} />}>
          选用此方案生成报价
        </Button>
      </CardBody>
    </Card>
  );
}

export function ReverseConfig() {
  const { addQuotation, setActiveTab, currentRole } = useAppStore();
  const roleInfo = roleViewMap[currentRole];

  const [productId, setProductId] = useState(1);
  const [minBudget, setMinBudget] = useState(600000);
  const [maxBudget, setMaxBudget] = useState(900000);
  const [perfWeight, setPerfWeight] = useState(0.7);
  const [resultCount, setResultCount] = useState(3);
  const [schemes, setSchemes] = useState<ConfigScheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleGenerate = () => {
    if (minBudget >= maxBudget) {
      setError('最低预算必须小于最高预算');
      return;
    }

    setError('');
    setLoading(true);
    setSchemes([]);

    setTimeout(() => {
      const result = generateSchemes(productId, minBudget, maxBudget, perfWeight);
      setSchemes(result.slice(0, resultCount));
      if (result.length === 0) setError('在此预算范围内未找到有效配置方案，请调整预算区间');
      setLoading(false);
    }, 900);
  };

  const handleSelectScheme = (scheme: ConfigScheme) => {
    addQuotation({
      id: Date.now(),
      quoteNumber: `FXK-CPQ-${Date.now()}`,
      quoteType: 'CPQ',
      customerName: '待同步纷享销客商机',
      projectName: `${scheme.schemeName} - AI 反向选配报价`,
      linkedOpportunity: `FXK-OPP-DEMO-${String(Date.now()).slice(-6)}`,
      sourceSystem: '纷享销客CRM',
      opportunityOwner: '售前演示',
      solutionSummary: Object.entries(scheme.configReadable).map(([feature, option]) => `${feature}:${option}`).join(' / '),
      totalCost: scheme.totalCost,
      totalPrice: scheme.totalPrice,
      grossProfitRate: Number(((scheme.totalPrice - scheme.totalCost) / scheme.totalPrice).toFixed(4)),
      currency: 'CNY',
      status: 'DRAFT',
      remarks: '正式交付场景下，该报价将与纷享销客商机绑定。',
      createdBy: 'demo-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setSuccessMessage(`"${scheme.schemeName}" 已生成报价单`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const costWeight = 1 - perfWeight;
  const roleGuide = currentRole === 'executive'
    ? '老板视角更适合对比三套方案的报价、成本和毛利差异。'
    : currentRole === 'sales'
      ? '销售视角更适合拿“均衡推荐方案”做客户首轮沟通。'
      : currentRole === 'presales'
        ? '售前视角更适合展开方案细节，对比约束命中与配置差异。'
        : currentRole === 'product'
          ? '产品视角更适合观察预算变化对方案结构的影响。'
          : '审批视角更适合关注各方案的毛利空间和风险等级。';

  return (
    <div className="p-6 space-y-6">
      <Card className="border border-blue-100 bg-blue-50/60">
        <CardBody className="p-5">
          <div className="flex items-start gap-3">
            <Link2 size={18} className="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{roleInfo.label}下的 AI 反向选配</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                先从纷享销客带入预算、场景与区域，再由 CPQ 规则引擎生成多套可行方案。当前演示保留手工录入预算能力。
              </p>
              <p className="text-[11px] text-slate-400 mt-2">{roleGuide}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-blue-500" />
                <h3 className="font-semibold text-slate-900 text-sm">反向选配参数</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">目标产品型号</label>
                <select
                  value={productId}
                  onChange={(event) => setProductId(Number(event.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                >
                  {mockModels.filter((model) => model.status === 'ACTIVE').map((model) => (
                    <option key={model.id} value={model.id}>{model.modelCode} - {model.modelName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">预算范围 (¥)</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1">最低预算</p>
                    <input
                      type="number"
                      value={minBudget}
                      onChange={(event) => setMinBudget(Number(event.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1">最高预算</p>
                    <input
                      type="number"
                      value={maxBudget}
                      onChange={(event) => setMaxBudget(Number(event.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">偏好权重</label>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>性能优先 {(perfWeight * 100).toFixed(0)}%</span>
                    <span>利润优先 {(costWeight * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={perfWeight * 100}
                    onChange={(event) => setPerfWeight(Number(event.target.value) / 100)}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">期望方案数量</label>
                <div className="flex gap-2">
                  {[2, 3, 5].map((count) => (
                    <button
                      key={count}
                      onClick={() => setResultCount(count)}
                      className={`flex-1 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                        resultCount === count
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="bg-red-50 rounded-xl p-3 text-xs text-red-700">{error}</div>}

              <Button className="w-full" icon={<Sparkles size={16} />} onClick={handleGenerate} loading={loading}>
                {loading ? '智能推算中...' : '生成推荐方案'}
              </Button>
            </CardBody>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-blue-500" />
              <span className="text-xs font-semibold text-slate-700">算法说明</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              系统先按预算区间枚举可行配置，再用规则引擎过滤冲突组合，
              最后结合性能权重和利润权重，生成更适合当前商机的 CPQ 推荐方案。
            </p>
          </Card>

          <Card className={`p-4 ${
            currentRole === 'approver' ? 'border border-red-100 bg-red-50/70'
              : currentRole === 'presales' ? 'border border-purple-100 bg-purple-50/70'
                : currentRole === 'sales' ? 'border border-emerald-100 bg-emerald-50/70'
                  : currentRole === 'product' ? 'border border-amber-100 bg-amber-50/70'
                    : 'border border-blue-100 bg-blue-50/70'
          }`}>
            <p className="text-sm font-semibold text-slate-900">{roleInfo.focus}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{roleGuide}</p>
          </Card>

          <Card className="border border-amber-100 bg-amber-50/60 p-4">
            <p className="text-xs text-amber-800 leading-relaxed">{demoDataNotice}</p>
          </Card>
        </div>

        <div className="xl:col-span-3">
          {successMessage && (
            <div className="mb-4 flex items-center gap-2 bg-emerald-50 rounded-xl p-3 text-emerald-700 text-sm">
              <CheckCircle size={15} />
              <span>{successMessage}</span>
              <button onClick={() => setActiveTab('quotations-list')} className="ml-auto underline text-xs">查看报价单</button>
            </div>
          )}

          {!loading && schemes.length === 0 && (
            <div className="h-80 flex flex-col items-center justify-center text-slate-300">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <Zap size={36} className="text-blue-300" />
              </div>
              <p className="text-slate-400 font-medium">设置参数后点击“生成推荐方案”</p>
              <p className="text-sm text-slate-300 mt-1">AI 会在预算范围内自动匹配最优配置</p>
            </div>
          )}

          {loading && (
            <div className="h-80 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin mb-4" />
              <p className="text-slate-500 font-medium">正在运行约束求解器...</p>
              <p className="text-sm text-slate-400 mt-1">遍历可行配置空间，评分排序中</p>
            </div>
          )}

          {!loading && schemes.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Sparkles size={14} className="text-blue-500" />
                  <span>在预算 ¥{minBudget.toLocaleString()} ~ ¥{maxBudget.toLocaleString()} 范围内，找到 <strong>{schemes.length}</strong> 个推荐方案</span>
                </div>
                <p className="text-xs text-slate-500">{roleGuide}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {schemes.map((scheme, index) => (
                  <SchemeCard key={`${scheme.schemeName}-${index}`} scheme={scheme} onSelect={() => handleSelectScheme(scheme)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
