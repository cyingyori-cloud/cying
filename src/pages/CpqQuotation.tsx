import { useState } from 'react';
import {
  ShoppingCart, CheckCircle, Package, ChevronRight,
  User, FileText, Calendar, MessageSquare, Link2,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { demoDataNotice, mockModels, mockFeatures, mockOptions, mockProductFeatureRels } from '../data/mockData';
import { roleViewMap } from '../data/roleViews';
import { useAppStore } from '../store/appStore';

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`;
}

export function CpqQuotation() {
  const { addQuotation, setActiveTab, currentRole, selectedSkuPlan } = useAppStore();
  const roleInfo = roleViewMap[currentRole];
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedModelId, setSelectedModelId] = useState<number>(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [form, setForm] = useState({
    customerName: '',
    customerContact: '',
    projectName: '',
    linkedOpportunity: '',
    remarks: '',
    validDays: 90,
    createdBy: 'demo-user',
  });
  const [success, setSuccess] = useState(false);

  const model = mockModels.find((item) => item.id === selectedModelId);
  const relations = mockProductFeatureRels.filter((relation) => relation.productModelId === selectedModelId);
  const featureIds = relations.map((relation) => relation.featureId);
  const features = mockFeatures.filter((feature) => featureIds.includes(feature.id));

  const handleSelectOption = (featureId: number, optionId: number) => {
    setSelectedOptions((previous) => ({ ...previous, [featureId]: optionId }));
  };

  const handleModelSelect = (id: number) => {
    setSelectedModelId(id);
    const defaults: Record<number, number> = {};
    mockProductFeatureRels
      .filter((relation) => relation.productModelId === id)
      .forEach((relation) => {
        if (relation.defaultOptionId) defaults[relation.featureId] = relation.defaultOptionId;
      });
    setSelectedOptions(defaults);
  };

  const basePrice = model?.basePrice ?? 0;
  const baseCost = model?.baseCost ?? 0;
  let optionsPriceSum = 0;
  let optionsCostSum = 0;

  Object.values(selectedOptions).forEach((optionId) => {
    const option = mockOptions.find((item) => item.id === optionId);
    if (option) {
      optionsPriceSum += option.priceImpact;
      optionsCostSum += option.cost;
    }
  });

  const totalPrice = basePrice + optionsPriceSum;
  const totalCost = baseCost + optionsCostSum;
  const grossMargin = totalPrice > 0 ? (totalPrice - totalCost) / totalPrice : 0;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + form.validDays);
  const roleHint = currentRole === 'executive'
    ? '老板视角可在此快速确认最终报价、毛利率和关联商机。'
    : currentRole === 'sales'
      ? '销售视角可在此补全商机信息并生成客户可回传报价。'
      : currentRole === 'presales'
        ? '售前视角可在此核对配置摘要、成本与交付口径。'
        : currentRole === 'product'
          ? '产品视角可在此观察配置结果如何沉淀成可复用报价样本。'
          : '审批视角可在此确认报价信息是否完整并判断是否需要升级审批。';

  const handleSubmit = () => {
    addQuotation({
      id: Date.now(),
      quoteNumber: `FXK-CPQ-${Date.now()}`,
      quoteType: 'CPQ',
      customerName: form.customerName || '待同步纷享销客商机',
      customerContact: form.customerContact,
      projectName: form.projectName,
      linkedOpportunity: form.linkedOpportunity || `FXK-OPP-DEMO-${String(Date.now()).slice(-6)}`,
      sourceSystem: '纷享销客CRM',
      opportunityOwner: form.createdBy,
      solutionSummary: [
        selectedSkuPlan ? `SKU:${selectedSkuPlan.skuCode}` : null,
        ...features.map((feature) => {
          const option = mockOptions.find((item) => item.id === selectedOptions[feature.id]);
          return option ? `${feature.featureName}:${option.optionName}` : '';
        }),
      ].filter(Boolean).join(' / '),
      totalCost,
      totalPrice,
      grossProfitRate: Number(grossMargin.toFixed(4)),
      currency: 'CNY',
      status: 'DRAFT',
      validUntil: validUntil.toISOString().slice(0, 10),
      remarks: form.remarks || (
        selectedSkuPlan
          ? `推荐SKU：${selectedSkuPlan.skuCode}；一级价 ${formatCurrency(selectedSkuPlan.pricingTiers.level1)}，二级价 ${formatCurrency(selectedSkuPlan.pricingTiers.level2)}，三级价 ${formatCurrency(selectedSkuPlan.pricingTiers.level3)}。`
          : '正式交付场景下，该报价将与纷享销客商机联动。'
      ),
      createdBy: form.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-96 gap-6">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle size={40} className="text-emerald-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">报价单创建成功</h2>
          <p className="text-slate-500 mt-1">CPQ 报价单已保存为草稿状态，可回到报价管理中提交审批</p>
          <div className="mt-4 bg-slate-50 rounded-2xl p-4 inline-block text-left">
            <div className="space-y-1 text-sm">
              <div className="flex gap-3">
                <span className="text-slate-400 w-20">产品型号</span>
                <span className="font-medium text-slate-800">{model?.modelCode}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-slate-400 w-20">报价金额</span>
                <span className="font-bold text-blue-600">{formatCurrency(totalPrice)}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-slate-400 w-20">关联商机</span>
                <span className="font-medium text-slate-800">{form.linkedOpportunity || '待同步纷享销客商机'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => {
            setSuccess(false);
            setStep(1);
            setForm({
              customerName: '',
              customerContact: '',
              projectName: '',
              linkedOpportunity: '',
              remarks: '',
              validDays: 90,
              createdBy: 'demo-user',
            });
            setSelectedOptions({});
          }}>
            新建报价
          </Button>
          <Button onClick={() => setActiveTab('quotations-list')} icon={<FileText size={16} />}>
            查看报价单列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card className="border border-blue-100 bg-blue-50/60">
        <CardBody className="p-5">
          <div className="flex items-start gap-3">
            <Link2 size={18} className="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{roleInfo.label}下的 CPQ 报价页</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                正式集成里，客户、联系人、商机号和项目名称由纷享销客 CRM 自动带入；本页保留手工补录，仅用于售前演示。
              </p>
              <p className="text-[11px] text-slate-400 mt-2">{roleHint}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {selectedSkuPlan && (
        <Card className="border border-purple-100 bg-purple-50/60">
          <CardBody className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-slate-900">当前报价承接的 SKU 方案</p>
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

      <div className="flex items-center gap-2">
        {[
          { n: 1, label: '选择产品型号' },
          { n: 2, label: '配置特征选项' },
          { n: 3, label: '商机与报价信息' },
        ].map((item, index) => (
          <div key={item.n} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              step === item.n
                ? 'bg-blue-600 text-white'
                : step > item.n
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-400'
            }`}>
              {step > item.n ? <CheckCircle size={16} /> : item.n}
            </div>
            <span className={`text-sm font-medium ${
              step === item.n ? 'text-blue-600' : step > item.n ? 'text-emerald-600' : 'text-slate-400'
            }`}>
              {item.label}
            </span>
            {index < 2 && <ChevronRight size={16} className="text-slate-300" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          {step === 1 && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900">选择产品型号</h3>
                <p className="text-xs text-slate-400 mt-0.5">选择需要报价的产品型号，系统将自动加载默认配置特征</p>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mockModels.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleModelSelect(item.id)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        selectedModelId === item.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-100 hover:border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Package size={14} className="text-blue-400 shrink-0" />
                            <span className="text-xs font-mono text-slate-400">{item.modelCode}</span>
                          </div>
                          <p className="font-medium text-slate-900 text-sm truncate">{item.modelName}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {[item.ratedPowerKw ? `${item.ratedPowerKw}kW` : null, item.ratedEnergyKWh ? `${item.ratedEnergyKWh}kWh` : null].filter(Boolean).join(' / ') || item.classification}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-blue-600 font-bold text-sm">{formatCurrency(item.basePrice)}</span>
                            {item.classification && <Badge variant="info" className="text-[10px]">{item.classification}</Badge>}
                          </div>
                        </div>
                        {selectedModelId === item.id && <CheckCircle size={16} className="text-blue-500 shrink-0 ml-2" />}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={() => setStep(2)} icon={<ChevronRight size={16} />}>
                    下一步：配置特征
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">配置特征选项</h3>
                    <p className="text-xs text-slate-400 mt-0.5">为 {model?.modelCode} 选择各项配置参数</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)}>返回上一步</Button>
                </div>
              </CardHeader>
              <CardBody className="space-y-5">
                {features.map((feature) => {
                  const options = mockOptions.filter((option) => option.featureId === feature.id && option.status === 'ACTIVE');
                  const relation = relations.find((item) => item.featureId === feature.id);
                  const selectedOptionId = selectedOptions[feature.id];
                  return (
                    <div key={feature.id}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="font-medium text-slate-800 text-sm">{feature.featureName}</span>
                        {relation?.isRequired && <Badge variant="danger" className="text-[10px]">必选</Badge>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {options.map((option) => {
                          const isSelected = selectedOptionId === option.id;
                          return (
                            <button
                              key={option.id}
                              onClick={() => handleSelectOption(feature.id, option.id)}
                              className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                                isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200 bg-white'
                              }`}
                            >
                              {isSelected && <CheckCircle size={13} className="absolute top-2 right-2 text-blue-500" />}
                              {option.isDefault && !isSelected && (
                                <Badge variant="default" className="absolute top-2 right-2 text-[9px] py-0">默认</Badge>
                              )}
                              <p className="text-xs font-medium text-slate-800 pr-5 leading-snug">{option.optionName}</p>
                              {option.optionValue && <p className="text-[10px] text-slate-400 mt-0.5">{option.optionValue}</p>}
                              <div className="mt-2 flex items-center justify-between">
                                <span className={`text-xs font-bold ${option.priceImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {option.priceImpact >= 0 ? '+' : ''}{formatCurrency(option.priceImpact)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <div className="w-8 h-1 bg-slate-100 rounded-full overflow-hidden">
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
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(1)}>返回</Button>
                  <Button onClick={() => setStep(3)} icon={<ChevronRight size={16} />}>下一步：商机信息</Button>
                </div>
              </CardBody>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">填写商机与报价信息</h3>
                    <p className="text-xs text-slate-400 mt-0.5">正式交付中，这些字段由纷享销客自动同步</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setStep(2)}>返回上一步</Button>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                      <Link2 size={12} />商机号
                    </label>
                    <input
                      type="text"
                      value={form.linkedOpportunity}
                      onChange={(event) => setForm({ ...form, linkedOpportunity: event.target.value })}
                      placeholder="如: FXK-OPP-ESS-202604-001"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                      <User size={12} />客户名称
                    </label>
                    <input
                      type="text"
                      value={form.customerName}
                      onChange={(event) => setForm({ ...form, customerName: event.target.value })}
                      placeholder="如: 华东工业园运营方"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                      <User size={12} />联系方式
                    </label>
                    <input
                      type="text"
                      value={form.customerContact}
                      onChange={(event) => setForm({ ...form, customerContact: event.target.value })}
                      placeholder="姓名 + 手机号"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                      <FileText size={12} />项目名称
                    </label>
                    <input
                      type="text"
                      value={form.projectName}
                      onChange={(event) => setForm({ ...form, projectName: event.target.value })}
                      placeholder="如: 300kWh 园区峰谷套利一期"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                      <Calendar size={12} />有效期（天）
                    </label>
                    <select
                      value={form.validDays}
                      onChange={(event) => setForm({ ...form, validDays: Number(event.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                    >
                      {[30, 60, 90, 180].map((days) => (
                        <option key={days} value={days}>{days}天</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                      <User size={12} />创建人
                    </label>
                    <input
                      type="text"
                      value={form.createdBy}
                      onChange={(event) => setForm({ ...form, createdBy: event.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                    <MessageSquare size={12} />备注
                  </label>
                  <textarea
                    value={form.remarks}
                    onChange={(event) => setForm({ ...form, remarks: event.target.value })}
                    rows={3}
                    placeholder="填写特殊要求或审批备注..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>返回</Button>
                  <Button className="flex-1" icon={<ShoppingCart size={16} />} onClick={handleSubmit}>
                    生成 CPQ 报价单
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900 text-sm">实时报价汇总</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white">
                <p className="text-blue-200 text-xs mb-1">配置总报价</p>
                <p className="text-4xl font-bold">{formatCurrency(totalPrice)}</p>
                <p className="text-blue-200 text-xs mt-1">预计毛利率 {(grossMargin * 100).toFixed(1)}%</p>
              </div>
              <div className="space-y-2">
                {[
                  { label: '产品基础报价', value: basePrice, className: 'text-slate-700' },
                  { label: '选配价格增量', value: optionsPriceSum, className: 'text-blue-600' },
                  { label: '产品基础成本', value: baseCost, className: 'text-slate-500' },
                  { label: '选配成本增量', value: optionsCostSum, className: 'text-slate-500' },
                  { label: '毛利润', value: totalPrice - totalCost, className: 'text-emerald-600' },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <span className={`font-semibold ${row.className}`}>{formatCurrency(row.value)}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {Object.keys(selectedOptions).length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900 text-sm">已选配置</h3>
              </CardHeader>
              <CardBody className="space-y-2">
                {features.map((feature) => {
                  const option = mockOptions.find((item) => item.id === selectedOptions[feature.id]);
                  return (
                    <div key={feature.id} className="flex justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-500">{feature.featureName}</span>
                      <span className={`font-medium ${option ? 'text-slate-800' : 'text-red-400'}`}>
                        {option ? option.optionName : '未选择'}
                      </span>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}

          <Card className="p-4 bg-amber-50 border-amber-100">
            <p className="text-xs text-amber-800 leading-relaxed">{demoDataNotice}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
