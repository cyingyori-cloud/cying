import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Zap, ShoppingCart, RotateCcw, Info, Link2 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  demoDataNotice, mockModels, mockFeatures, mockOptions, mockProductFeatureRels, mockRules,
} from '../data/mockData';
import { roleViewMap } from '../data/roleViews';
import { useAppStore } from '../store/appStore';

function validateRules(productModelId: number, selectedOptions: Record<number, number>): string[] {
  const violations: string[] = [];
  const applicableRules = mockRules.filter(
    (rule) => rule.isActive && (!rule.productModelId || rule.productModelId === productModelId),
  );

  for (const rule of applicableRules) {
    const conditions = rule.items?.filter((item) => item.itemRole === 'CONDITION') ?? [];
    const actions = rule.items?.filter((item) => item.itemRole === 'ACTION') ?? [];

    const conditionsMet = conditions.every((condition) => {
      const selectedOptionId = selectedOptions[condition.featureId];
      if (condition.operator === 'EQUALS') return selectedOptionId === condition.featureOptionId;
      if (condition.operator === 'NOT_EQUALS') return selectedOptionId !== condition.featureOptionId;
      return true;
    });

    if (!conditionsMet) continue;

    if (rule.ruleType === 'EXCLUSION') {
      actions.forEach((action) => {
        if (selectedOptions[action.featureId] === action.featureOptionId) {
          const feature = mockFeatures.find((item) => item.id === action.featureId)?.featureName ?? '特征';
          const option = mockOptions.find((item) => item.id === action.featureOptionId)?.optionName ?? '选项';
          violations.push(`【互斥冲突】${rule.ruleName}: 不可同时选择 ${feature} - ${option}`);
        }
      });
    } else if (rule.ruleType === 'DEPENDENCY') {
      actions.forEach((action) => {
        if (selectedOptions[action.featureId] !== action.featureOptionId) {
          const feature = mockFeatures.find((item) => item.id === action.featureId)?.featureName ?? '特征';
          const option = mockOptions.find((item) => item.id === action.featureOptionId)?.optionName ?? '选项';
          violations.push(`【依赖未满足】${rule.ruleName}: 必须选择 ${feature} - ${option}`);
        }
      });
    }
  }

  return violations;
}

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`;
}

export function ForwardConfig() {
  const {
    selectedProduct,
    selectedSkuPlan,
    setSelectedProduct,
    selectedOptions,
    setSelectedOption,
    clearSelectedOptions,
    configuredPrice,
    configuredCost,
    setConfiguredPrice,
    setConfiguredCost,
    ruleViolations,
    setRuleViolations,
    addQuotation,
    setActiveTab,
    currentRole,
  } = useAppStore();
  const roleInfo = roleViewMap[currentRole];

  const [quoteSuccess, setQuoteSuccess] = useState(false);
  const product = selectedProduct ?? mockModels[0];

  useEffect(() => {
    if (!selectedProduct) setSelectedProduct(mockModels[0]);
  }, [selectedProduct, setSelectedProduct]);

  const relations = useMemo(
    () => (product ? mockProductFeatureRels.filter((relation) => relation.productModelId === product.id) : []),
    [product],
  );
  const featureIds = relations.map((relation) => relation.featureId);
  const features = mockFeatures.filter((feature) => featureIds.includes(feature.id));

  useEffect(() => {
    if (!product) return;

    const defaults: Record<number, number> = {};
    relations.forEach((relation) => {
      if (relation.defaultOptionId) defaults[relation.featureId] = relation.defaultOptionId;
    });

    if (Object.keys(selectedOptions).length === 0) {
      Object.entries(defaults).forEach(([featureId, optionId]) => setSelectedOption(Number(featureId), optionId));
    }
  }, [product, relations, selectedOptions, setSelectedOption]);

  useEffect(() => {
    if (!product) return;

    let nextPrice = product.basePrice;
    let nextCost = product.baseCost ?? product.basePrice * 0.82;

    Object.values(selectedOptions).forEach((optionId) => {
      const option = mockOptions.find((item) => item.id === optionId);
      if (option) {
        nextPrice += option.priceImpact;
        nextCost += option.cost;
      }
    });

    setConfiguredPrice(nextPrice);
    setConfiguredCost(nextCost);
    setRuleViolations(validateRules(product.id, selectedOptions));
  }, [selectedOptions, product, setConfiguredPrice, setConfiguredCost, setRuleViolations]);

  const handleReset = () => {
    clearSelectedOptions();
    relations.forEach((relation) => {
      if (relation.defaultOptionId) setSelectedOption(relation.featureId, relation.defaultOptionId);
    });
  };

  const totalPerformance = featureIds.length > 0
    ? featureIds.reduce((sum, featureId) => {
      const option = mockOptions.find((item) => item.id === selectedOptions[featureId]);
      return sum + (option?.performanceScore ?? 0);
    }, 0) / featureIds.length
    : 0;

  const selectedOptionLabels = features.map((feature) => {
    const option = mockOptions.find((item) => item.id === selectedOptions[feature.id]);
    return option ? `${feature.featureName}:${option.optionName}` : '';
  }).filter(Boolean);

  const optionPriceDelta = configuredPrice - product.basePrice;
  const optionCostDelta = configuredCost - (product.baseCost ?? 0);
  const grossProfit = configuredPrice - configuredCost;
  const grossMargin = configuredPrice > 0 ? grossProfit / configuredPrice : 0;
  const approvalHint = grossMargin < 0.12
    ? { variant: 'danger' as const, label: '建议升级审批', text: '预计毛利率低于 12%，建议走高级别审批。' }
    : grossMargin < 0.18
      ? { variant: 'warning' as const, label: '常规审批', text: '毛利率处于正常区间，适合走标准审批路径。' }
      : { variant: 'success' as const, label: '自动审批候选', text: '毛利率与规则校验均健康，可作为自动审批候选。' };
  const overrideCount = relations.filter((relation) => selectedOptions[relation.featureId] !== relation.defaultOptionId).length;
  const roleGuide = currentRole === 'executive'
    ? {
      title: '老板视角',
      body: `当前配置预计报价 ${formatCurrency(configuredPrice)}，毛利率 ${(grossMargin * 100).toFixed(1)}%，适合快速判断项目值不值得推进。`,
      tone: 'blue',
    }
    : currentRole === 'sales'
      ? {
        title: '销售视角',
        body: `可直接向客户讲解的关键词：${selectedOptionLabels.slice(0, 3).join(' / ') || '标准配置口径'}。`,
        tone: 'emerald',
      }
      : currentRole === 'presales'
        ? {
          title: '售前视角',
          body: `已覆盖 ${features.length} 个关键特征，当前有 ${ruleViolations.length} 个冲突，建议同步核查认证与并机口径。`,
          tone: 'purple',
        }
        : currentRole === 'product'
          ? {
            title: '产品视角',
            body: `当前方案相对默认配置改动 ${overrideCount} 项，可作为规则与主数据优化的反馈样本。`,
            tone: 'amber',
          }
          : {
            title: '审批视角',
            body: `当前审批建议为“${approvalHint.label}”，请重点关注毛利率、规则冲突和项目特殊条款。`,
            tone: approvalHint.variant === 'danger' ? 'red' : 'emerald',
          };

  const handleCreateQuote = () => {
    if (!product || ruleViolations.length > 0) return;

    addQuotation({
      id: Date.now(),
      quoteNumber: `FXK-CPQ-${Date.now()}`,
      quoteType: 'CPQ',
      customerName: '待同步纷享销客商机',
      projectName: `${product.modelName} 智能选配报价`,
      linkedOpportunity: `FXK-OPP-DEMO-${String(Date.now()).slice(-6)}`,
      sourceSystem: '纷享销客CRM',
      opportunityOwner: '售前演示',
      solutionSummary: [
        selectedSkuPlan ? `SKU:${selectedSkuPlan.skuCode}` : null,
        ...selectedOptionLabels,
      ].filter(Boolean).join(' / '),
      totalCost: configuredCost,
      totalPrice: configuredPrice,
      grossProfitRate: Number(grossMargin.toFixed(4)),
      currency: 'CNY',
      status: 'DRAFT',
      remarks: selectedSkuPlan
        ? `推荐SKU：${selectedSkuPlan.skuCode}；一级价 ${formatCurrency(selectedSkuPlan.pricingTiers.level1)}，二级价 ${formatCurrency(selectedSkuPlan.pricingTiers.level2)}，三级价 ${formatCurrency(selectedSkuPlan.pricingTiers.level3)}。`
        : '正式交付场景下，客户、联系人与项目主数据由纷享销客 CRM 自动带入。',
      createdBy: 'demo-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setQuoteSuccess(true);
    setTimeout(() => setQuoteSuccess(false), 3000);
  };

  return (
    <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-4">
        <Card className="border border-blue-100 bg-blue-50/60">
          <CardBody className="p-5">
            <div className="flex items-start gap-3">
              <Link2 size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{roleInfo.label}下的正向选配</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  正式项目中，客户、联系人、项目名和商机号由纷享销客 CRM 自动同步到 CPQ。
                  当前页面保留手工演示能力，但定位只聚焦产品配置、规则校验和报价生成。
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {selectedSkuPlan && (
          <Card className="border border-purple-100 bg-purple-50/60">
            <CardBody className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-900">已带入推荐 SKU</p>
                  <p className="text-xs text-slate-500 mt-1">{selectedSkuPlan.skuCode}</p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    模组 {selectedSkuPlan.moduleCount} / 模组消防 {selectedSkuPlan.moduleFire ? '是' : '否'} / 机柜消防 {selectedSkuPlan.cabinetFire ? '是' : '否'} / {selectedSkuPlan.lineType}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs min-w-[260px]">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-slate-400">一级价</p>
                    <p className="font-semibold text-slate-800">{formatCurrency(selectedSkuPlan.pricingTiers.level1)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-slate-400">二级价</p>
                    <p className="font-semibold text-slate-800">{formatCurrency(selectedSkuPlan.pricingTiers.level2)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-slate-400">三级价</p>
                    <p className="font-semibold text-slate-800">{formatCurrency(selectedSkuPlan.pricingTiers.level3)}</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900 text-sm">选择产品型号</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mockModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedProduct(model);
                    clearSelectedOptions();
                  }}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    product?.id === model.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-slate-400">{model.modelCode}</p>
                      <p className="font-medium text-slate-900 text-sm mt-0.5 truncate">{model.modelName}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {[model.ratedPowerKw ? `${model.ratedPowerKw}kW` : null, model.ratedEnergyKWh ? `${model.ratedEnergyKWh}kWh` : null].filter(Boolean).join(' / ') || '公开参数整理中'}
                      </p>
                      <p className="text-blue-600 font-bold mt-2">{formatCurrency(model.basePrice)}</p>
                    </div>
                    {product?.id === model.id && <CheckCircle size={16} className="text-blue-500 shrink-0 mt-1" />}
                  </div>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {product && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">配置特征选项</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{product.modelName}</p>
                </div>
                <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={handleReset}>
                  重置默认
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-6">
              {features.map((feature) => {
                const options = mockOptions.filter((option) => option.featureId === feature.id && option.status === 'ACTIVE');
                const relation = relations.find((item) => item.featureId === feature.id);
                const selectedOptionId = selectedOptions[feature.id];

                return (
                  <div key={feature.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-medium text-slate-800 text-sm">{feature.featureName}</h4>
                      {relation?.isRequired && <Badge variant="danger" className="text-[10px]">必选</Badge>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {options.map((option) => {
                        const isSelected = selectedOptionId === option.id;
                        const isExcluded = ruleViolations.some((violation) => violation.includes(option.optionName) && violation.includes('互斥'));

                        return (
                          <button
                            key={option.id}
                            onClick={() => setSelectedOption(feature.id, option.id)}
                            disabled={isExcluded}
                            className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : isExcluded
                                  ? 'border-red-200 bg-red-50/50 opacity-50 cursor-not-allowed'
                                  : 'border-slate-100 hover:border-slate-200 bg-white'
                            }`}
                          >
                            {isSelected && <CheckCircle size={14} className="absolute top-2 right-2 text-blue-500" />}
                            {isExcluded && <XCircle size={14} className="absolute top-2 right-2 text-red-400" />}
                            {option.isDefault && !isSelected && (
                              <Badge variant="default" className="text-[10px] absolute top-2 right-2">默认</Badge>
                            )}
                            <p className="text-xs font-medium text-slate-800 pr-6">{option.optionName}</p>
                            {option.optionValue && <p className="text-xs text-slate-400 mt-0.5">{option.optionValue}</p>}
                            <div className="mt-2 flex items-center justify-between">
                              <span className={`text-xs font-semibold ${option.priceImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {option.priceImpact >= 0 ? '+' : ''}{formatCurrency(option.priceImpact)}
                              </span>
                              <div className="flex items-center gap-1">
                                <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${option.performanceScore}%` }} />
                                </div>
                                <span className="text-[10px] text-slate-400">{option.performanceScore}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">价格汇总</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white">
              <p className="text-blue-200 text-sm">配置总报价</p>
              <p className="text-4xl font-bold mt-1">{formatCurrency(configuredPrice)}</p>
              <p className="text-blue-200 text-xs mt-1">预计毛利率 {(grossMargin * 100).toFixed(1)}%</p>
            </div>
            <div className="space-y-2.5">
              {[
                { label: '产品基础报价', value: product.basePrice, className: 'text-slate-700' },
                { label: '选配价格增量', value: optionPriceDelta, className: 'text-blue-600' },
                { label: '产品基础成本', value: product.baseCost ?? 0, className: 'text-slate-500' },
                { label: '选配成本增量', value: optionCostDelta, className: 'text-slate-500' },
                { label: '毛利润', value: grossProfit, className: 'text-emerald-600' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{row.label}</span>
                  <span className={`font-semibold ${row.className}`}>{formatCurrency(row.value)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>综合性能评分</span>
                <span className="font-semibold text-slate-700">{totalPerformance.toFixed(1)}/100</span>
              </div>
              <div className="mt-1.5 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${totalPerformance}%` }}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className={`border ${
          roleGuide.tone === 'red' ? 'border-red-100 bg-red-50/70'
            : roleGuide.tone === 'emerald' ? 'border-emerald-100 bg-emerald-50/70'
              : roleGuide.tone === 'purple' ? 'border-purple-100 bg-purple-50/70'
                : roleGuide.tone === 'amber' ? 'border-amber-100 bg-amber-50/70'
                  : 'border-blue-100 bg-blue-50/70'
        }`}>
          <CardBody className="p-4">
            <p className="text-sm font-semibold text-slate-900">{roleGuide.title}</p>
            <p className="text-xs mt-1 leading-relaxed text-slate-600">{roleGuide.body}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-sm">规则校验</h3>
              {ruleViolations.length === 0
                ? <Badge variant="success">通过</Badge>
                : <Badge variant="danger">{ruleViolations.length} 项冲突</Badge>}
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className={`rounded-xl px-4 py-3 text-sm ${
              ruleViolations.length === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              {ruleViolations.length === 0 ? (
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  <span>当前配置符合所有已启用规则约束</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {ruleViolations.map((violation) => (
                    <div key={violation} className="flex items-start gap-2">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <span>{violation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={`rounded-xl px-4 py-3 text-xs ${
              approvalHint.variant === 'danger' ? 'bg-red-50 text-red-700'
                : approvalHint.variant === 'warning' ? 'bg-amber-50 text-amber-800'
                  : 'bg-emerald-50 text-emerald-700'
            }`}>
              <div className="flex items-center gap-2 font-semibold">
                <Info size={13} />
                <span>{approvalHint.label}</span>
              </div>
              <p className="mt-1 leading-relaxed">{approvalHint.text}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900 text-sm">已选配置清单</h3>
          </CardHeader>
          <CardBody className="space-y-2">
            {features.map((feature) => {
              const option = mockOptions.find((item) => item.id === selectedOptions[feature.id]);
              return (
                <div key={feature.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-slate-500">{feature.featureName}</span>
                  <div className="flex items-center gap-1.5">
                    {option ? (
                      <>
                        <span className="font-medium text-slate-800">{option.optionName}</span>
                        <Info size={11} className="text-slate-300" />
                      </>
                    ) : (
                      <span className="text-slate-300">未选</span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card className="border border-amber-100 bg-amber-50/60">
          <CardBody className="p-4 text-xs text-amber-800 leading-relaxed">
            {demoDataNotice}
          </CardBody>
        </Card>

        <div className="space-y-2">
          {quoteSuccess && (
            <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-3 text-emerald-700 text-sm">
              <CheckCircle size={15} />
              <span>报价单已创建成功，可继续回到纷享销客推进商机。</span>
              <button onClick={() => setActiveTab('quotations-list')} className="underline text-xs ml-auto">查看</button>
            </div>
          )}
          <Button
            className="w-full"
            icon={<ShoppingCart size={16} />}
            onClick={handleCreateQuote}
            disabled={ruleViolations.length > 0}
          >
            生成 CPQ 报价单
          </Button>
          <Button
            variant="outline"
            className="w-full"
            icon={<Zap size={16} />}
            onClick={() => setActiveTab('configurator-reverse')}
          >
            切换至 AI 反向选配
          </Button>
        </div>
      </div>
    </div>
  );
}
