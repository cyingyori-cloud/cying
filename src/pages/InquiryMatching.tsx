import { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, Link2, Radar, ShieldAlert,
  Zap, Battery, Clock, FileText, Star, TrendingUp, XCircle, HelpCircle,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useAppStore } from '../store/appStore';
import { roleViewMap } from '../data/roleViews';
import { mockModels } from '../data/mockData';
import type { GeneratedSkuPlan, ProductModel } from '../types';

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

type YesNoAll = '全部' | '带消防' | '不带消防';
type LineTypeFilter = '全部' | '2线' | '3线';

interface RecommendedProduct {
  product: ProductModel;
  score: number;
  reason: string;
}

interface PreviewSkuPlan extends GeneratedSkuPlan {
  rankScore: number;
  estimatedCost: number;
  analysisSummary: string;
  analysisNotes: string[];
  analysisStatusLabel: string;
  analysisStatusDetail: string;
}

const REFERENCE_ROWS: Record<number, { rackQty: number; minVdc: number; maxVdc: number; backupEolMin: number; maxCurrent: number }> = {
  8: { rackQty: 4, minVdc: 358.4, maxVdc: 441.6, backupEolMin: 8.52, maxCurrent: 634.46 },
  9: { rackQty: 4, minVdc: 403.2, maxVdc: 496.8, backupEolMin: 9.58, maxCurrent: 563.97 },
  10: { rackQty: 4, minVdc: 448.0, maxVdc: 552.0, backupEolMin: 10.64, maxCurrent: 507.57 },
  11: { rackQty: 3, minVdc: 492.8, maxVdc: 607.2, backupEolMin: 8.78, maxCurrent: 615.23 },
  12: { rackQty: 3, minVdc: 537.6, maxVdc: 662.4, backupEolMin: 9.58, maxCurrent: 563.97 },
};

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`;
}

function riskBadge(level: RiskLevel) {
  if (level === 'HIGH') return { variant: 'danger' as const, label: '高风险' };
  if (level === 'MEDIUM') return { variant: 'warning' as const, label: '需确认' };
  return { variant: 'success' as const, label: '可推进' };
}

function skuStatusBadge(status: PreviewSkuPlan['status']) {
  if (status === 'VALID') return { variant: 'success' as const, label: '可直接推进' };
  if (status === 'WARNING') return { variant: 'warning' as const, label: '需技术确认' };
  return { variant: 'danger' as const, label: '超限需复核' };
}

// 分析状态差异化标签 - 用于 AI匹配分析状态 列展示
function analysisStatusBadge(label: string) {
  const map: Array<{ key: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'cyan' | 'indigo' | 'amber'; icon: React.ReactNode }> = [
    { key: '推荐方案', variant: 'success', icon: <Star size={11} /> },
    { key: '可直接推进', variant: 'success', icon: <CheckCircle2 size={11} /> },
    { key: '时长临界', variant: 'cyan', icon: <Clock size={11} /> },
    { key: '电流边界', variant: 'warning', icon: <TrendingUp size={11} /> },
    { key: '需补充说明', variant: 'purple', icon: <FileText size={11} /> },
    { key: '续航偏差', variant: 'amber', icon: <Battery size={11} /> },
    { key: '需技术确认', variant: 'warning', icon: <AlertTriangle size={11} /> },
    { key: '电压超界', variant: 'danger', icon: <Zap size={11} /> },
    { key: '电流超界', variant: 'danger', icon: <XCircle size={11} /> },
    { key: '超限需复核', variant: 'danger', icon: <ShieldAlert size={11} /> },
  ];
  const found = map.find((m) => m.key === label);
  if (found) return { variant: found.variant, icon: found.icon };
  return { variant: 'info' as const, icon: <HelpCircle size={11} /> };
}

function scenarioMatches(product: ProductModel, scenario: string) {
  if (scenario === 'AIDC') return (product.classification ?? '').includes('AIDC');
  if (scenario === '工商业') return (product.classification ?? '').includes('工商业');
  if (scenario === '户储') return (product.classification ?? '').includes('住宅');
  return true;
}

function pickRecommendedProduct(
  scenario: string,
  targetPowerKw: number,
  targetEnergyKWh: number,
): RecommendedProduct {
  const ranked = mockModels.map((product) => {
    const power = product.ratedPowerKw ?? 0;
    const energy = product.ratedEnergyKWh ?? 0;
    let score = 100;
    score -= Math.abs(power - targetPowerKw) * 0.08;
    score -= Math.abs(energy - targetEnergyKWh) * 0.12;
    if (!scenarioMatches(product, scenario)) score -= 18;
    if ((product.parallelCapability ?? '').includes('并联')) score += 4;
    return { product, score };
  }).sort((a, b) => b.score - a.score);

  const winner = ranked[0].product;
  return {
    product: winner,
    score: Math.round(ranked[0].score),
    reason: `${winner.modelName} 在场景、功率容量和区域口径上最接近当前需求，适合作为方案组合的推荐产品族。`,
  };
}

function buildSkuPlans(
  recommendedProduct: ProductModel,
  form: {
    targetPowerKw: number;
    targetEnergyKWh: number;
    backupMinutes: number;
    moduleCounts: number[];
    moduleFireFilter: YesNoAll;
    cabinetFireFilter: YesNoAll;
    lineTypeFilter: LineTypeFilter;
    dcVoltageMin: number;
    dcVoltageMax: number;
    specialRequirements: string;
  },
): PreviewSkuPlan[] {
  const moduleFireOptions = form.moduleFireFilter === '全部'
    ? [true, false]
    : [form.moduleFireFilter === '带消防'];
  const cabinetFireOptions = form.cabinetFireFilter === '全部'
    ? [true, false]
    : [form.cabinetFireFilter === '带消防'];
  const lineTypeOptions = form.lineTypeFilter === '全部'
    ? (['2线', '3线'] as const)
    : ([form.lineTypeFilter] as const);

  const rows: PreviewSkuPlan[] = [];

  form.moduleCounts.forEach((moduleCount) => {
    const ref = REFERENCE_ROWS[moduleCount];
    if (!ref) return;
    moduleFireOptions.forEach((moduleFire) => {
      cabinetFireOptions.forEach((cabinetFire) => {
        lineTypeOptions.forEach((lineType) => {
          const powerFactor = 0.9;
          const efficiency = 0.6;
          const lineVoltageBoost = lineType === '3线' ? 1.0 : 0.92;
          const fireVoltagePenalty = cabinetFire ? 0.99 : 1;
          const estimatedMinVdc = Number((ref.minVdc * lineVoltageBoost * fireVoltagePenalty).toFixed(1));
          const estimatedMaxVdc = Number((ref.maxVdc * lineVoltageBoost * fireVoltagePenalty).toFixed(1));
          const effectivePowerKw = Number((form.targetPowerKw * powerFactor * efficiency).toFixed(2));
          const rackEnergyKWh = Number((moduleCount * 1.86).toFixed(2));
          const cabinetCount = Math.max(1, Math.round(form.targetEnergyKWh / Math.max(rackEnergyKWh, 1)));
          const estimatedEnergyKWh = Number((rackEnergyKWh * cabinetCount).toFixed(2));
          const estimatedBackupMin = Number(((estimatedEnergyKWh / Math.max(form.targetPowerKw, 1)) * 60).toFixed(2));
          const estimatedCurrent = Number(((effectivePowerKw * 1000) / Math.max(estimatedMinVdc, 1)).toFixed(2));

          const warnings: string[] = [];
          const analysisNotes: string[] = [];
          const voltageOut = estimatedMinVdc < form.dcVoltageMin || estimatedMaxVdc > form.dcVoltageMax;
          const currentOver = estimatedCurrent > 600;
          const currentNear = estimatedCurrent > 560;
          const backupShort = estimatedBackupMin < form.backupMinutes * 0.92;
          const backupNear = estimatedBackupMin < form.backupMinutes;
          const hasSpecial = form.specialRequirements.trim().length > 0;
          if (voltageOut) {
            warnings.push(`电压范围 ${estimatedMinVdc}-${estimatedMaxVdc}V 与客户要求 ${form.dcVoltageMin}-${form.dcVoltageMax}V 不一致。`);
          }
          if (currentOver) {
            warnings.push(`最大放电电流 ${estimatedCurrent}A 超过 600A 阈值，需要技术确认。`);
          }
          if (backupShort) {
            warnings.push(`备电时长 ${estimatedBackupMin}min 低于目标 ${form.backupMinutes}min。`);
          }

          analysisNotes.push(`按公式计算功率口径：${form.targetPowerKw} × 效率${efficiency} × PF${powerFactor} = ${effectivePowerKw}kW。`);
          analysisNotes.push(`模组数 ${moduleCount}、每柜能量 ${rackEnergyKWh}kWh，按目标容量 ${form.targetEnergyKWh}kWh 推算需 ${cabinetCount} 柜。`);
          analysisNotes.push(`电压范围推算为 ${estimatedMinVdc}-${estimatedMaxVdc}V，放电电流推算为 ${estimatedCurrent}A。`);
          if (hasSpecial) {
            analysisNotes.push('客户存在特殊需求，系统保留方案，但需补充方案说明和专家确认。');
          }

          const status: PreviewSkuPlan['status'] = (
            voltageOut || currentOver
          ) ? 'INVALID' : (currentNear || backupNear || hasSpecial) ? 'WARNING' : 'VALID';

          // Demo展示用：差异化状态标签（实际业务中应基于真实计算）
          let analysisStatusLabel = '可直接推进';
          let analysisStatusDetail = '电压、电流与时长均处于建议边界内。';
          
          // 根据模组数+消防组合生成差异化标签（Demo展示用）
          const demoStatusIndex = (moduleCount + (moduleFire ? 2 : 0) + (lineType === '3线' ? 1 : 0)) % 10;
          const demoLabels = [
            { label: '推荐方案', detail: '柜数更少、边界更稳、适合优先推进。' },
            { label: '可直接推进', detail: '电压、电流与时长均处于建议边界内。' },
            { label: '时长临界', detail: '备电时长接近目标边界，可作为备选方案。' },
            { label: '电流边界', detail: '虽然未超限，但已经接近 600A 边界。' },
            { label: '需补充说明', detail: '方案可保留，但需写清客户特殊要求与例外原因。' },
            { label: '续航偏差', detail: '备电时长明显低于目标值，需要重新权衡。' },
            { label: '需技术确认', detail: '存在技术边界情况，需要工程部门确认。' },
            { label: '电压超界', detail: '电压上下界超出客户要求，需要先复核边界。' },
            { label: '电流超界', detail: '最大放电电流超过 600A，不建议直接报价。' },
            { label: '超限需复核', detail: '方案超出关键边界，不建议直接报价。' },
          ];
          const demoStatus = demoLabels[demoStatusIndex];
          analysisStatusLabel = demoStatus.label;
          analysisStatusDetail = demoStatus.detail;

          const baseCost = Math.round((recommendedProduct.baseCost ?? recommendedProduct.basePrice * 0.82) * (moduleCount / 10) * cabinetCount * Math.max(form.backupMinutes / 15, 0.8));
          const extraCost = (moduleFire ? 6000 : 0) + (cabinetFire ? 9000 : 0) + (lineType === '3线' ? 3000 : 0);
          const estimatedCost = baseCost + extraCost;
          const pricingTiers = {
            level1: Math.round(estimatedCost * 1.2),
            level2: Math.round(estimatedCost * 1.15),
            level3: Math.round(estimatedCost * 1.1),
          };
          const rankScore = (
            (status === 'VALID' ? 110 : status === 'WARNING' ? 70 : 24)
            - cabinetCount * 10
            - warnings.length * 6
            - Math.abs(form.targetEnergyKWh - estimatedEnergyKWh) * 0.45
            - Math.abs(form.backupMinutes - estimatedBackupMin) * 1.2
            + (lineType === '3线' ? 3 : 0)
            + (moduleCount >= 10 ? 2 : 0)
          );

          const analysisSummary = status === 'VALID'
            ? `电压、电流均落在建议边界内，且 ${cabinetCount} 柜即可满足当前目标，是可直接推进方案。`
            : status === 'WARNING'
              ? `方案基本可行，但存在 ${warnings.length} 条软预警，需补技术说明后再继续。`
              : `方案超出关键边界，不建议直接报价，应先进入专家复核。`;

          rows.push({
            skuCode: [
              recommendedProduct.modelCode || recommendedProduct.modelName.replace(/\s+/g, '').slice(0, 8).toUpperCase(),
              `M${moduleCount}`,
              moduleFire ? 'MF' : 'MN',
              cabinetFire ? 'CF' : 'CN',
              lineType === '2线' ? '2L' : '3L',
            ].join('-'),
            moduleCount,
            moduleFire,
            cabinetFire,
            lineType,
            cabinetCount,
            estimatedVoltage: estimatedMaxVdc,
            estimatedCurrent,
            estimatedEnergyKWh,
            status,
            warningReasons: warnings,
            recommended: false,
            pricingTiers,
            rankScore,
            estimatedCost,
            analysisSummary,
            analysisNotes,
            analysisStatusLabel,
            analysisStatusDetail,
          });
        });
      });
    });
  });

  const sorted = rows.sort((a, b) => b.rankScore - a.rankScore);
  if (sorted[0]) {
    sorted[0].recommended = true;
    // Demo展示：最高分的行显示"推荐方案"
    sorted[0].analysisStatusLabel = '推荐方案';
    sorted[0].analysisStatusDetail = '柜数更少、边界更稳、适合优先推进。';
  }
  return sorted.slice(0, 10);
}

export function InquiryMatching() {
  const { setSelectedProduct, setSelectedSkuPlan, setActiveTab, currentRole } = useAppStore();
  const roleInfo = roleViewMap[currentRole];
  const canProceedToConfig = currentRole === 'sales' || currentRole === 'presales';
  const initialForm = {
    projectName: 'AIDC 机房 15 分钟备电',
    scenario: 'AIDC',
    targetPowerKw: 420,
    targetEnergyKWh: 60,
    backupMinutes: 15,
    dcVoltageMin: 520,
    dcVoltageMax: 680,
    topology: '模块化 UPS',
    specialRequirements: '客户要求高海拔部署，允许超限方案展示，但必须标红并走技术复核。',
    moduleCounts: [8, 9, 10, 11],
    moduleFireFilter: '全部' as YesNoAll,
    cabinetFireFilter: '全部' as YesNoAll,
    lineTypeFilter: '全部' as LineTypeFilter,
  };
  const [form, setForm] = useState(initialForm);
  const [appliedForm, setAppliedForm] = useState(initialForm);
  const [selectedSkuCode, setSelectedSkuCode] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const recommended = useMemo(
    () => pickRecommendedProduct(appliedForm.scenario, appliedForm.targetPowerKw, appliedForm.targetEnergyKWh),
    [appliedForm.scenario, appliedForm.targetPowerKw, appliedForm.targetEnergyKWh],
  );

  const skuPlans = useMemo(
    () => buildSkuPlans(recommended.product, appliedForm),
    [recommended, appliedForm],
  );

  const selectedSku = skuPlans.find((item) => item.skuCode === selectedSkuCode) ?? skuPlans[0];

  const toggleModuleCount = (count: number) => {
    setForm((current) => {
      const next = current.moduleCounts.includes(count)
        ? current.moduleCounts.filter((item) => item !== count)
        : [...current.moduleCounts, count].sort((a, b) => a - b);
      return { ...current, moduleCounts: next.length > 0 ? next : [count] };
    });
  };

  const handleApplyConfig = () => {
    setAppliedForm(form);
    setSelectedSkuCode(null);
  };

  const jumpToConfig = () => {
    setSelectedProduct(recommended.product);
    setSelectedSkuPlan(selectedSku ?? null);
    setActiveTab('configurator-forward');
  };

  const selectedRiskLevel: RiskLevel = selectedSku?.status === 'INVALID'
    ? 'HIGH'
    : selectedSku?.status === 'WARNING'
      ? 'MEDIUM'
      : 'LOW';

  return (
    <div className="p-6 space-y-4">
      <Card className="border border-brand-100 bg-brand-50/60">
        <CardBody className="p-5">
          <div className="flex items-start gap-3">
            <ClipboardList size={18} className="text-brand-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{roleInfo.label}下的需求录入与候选匹配</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                先录客户需求参数，再查看一组可选方案组合与软预警结果，最后挑选一条方案进入配置与报价。
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">客户需求参数录入</h3>
            <p className="text-xs text-slate-400 mt-0.5">围绕业务调研纪要里的询价口径和方案生成维度做结构化录入。</p>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <label className="text-xs font-medium text-slate-600">
                项目名称
                <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-slate-600">
                场景
                <select className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" value={form.scenario} onChange={(e) => setForm({ ...form, scenario: e.target.value })}>
                  <option value="AIDC">AIDC/UPS 备电</option>
                  <option value="工商业">工商业储能</option>
                  <option value="户储">户储</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                目标功率 (kW)
                <input type="number" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.targetPowerKw} onChange={(e) => setForm({ ...form, targetPowerKw: Number(e.target.value) })} />
              </label>
              <label className="text-xs font-medium text-slate-600">
                目标容量 (kWh)
                <input type="number" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.targetEnergyKWh} onChange={(e) => setForm({ ...form, targetEnergyKWh: Number(e.target.value) })} />
              </label>
              <label className="text-xs font-medium text-slate-600">
                备电时长 (min)
                <input type="number" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.backupMinutes} onChange={(e) => setForm({ ...form, backupMinutes: Number(e.target.value) })} />
              </label>
              <label className="text-xs font-medium text-slate-600">
                DC 最低电压
                <input type="number" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.dcVoltageMin} onChange={(e) => setForm({ ...form, dcVoltageMin: Number(e.target.value) })} />
              </label>
              <label className="text-xs font-medium text-slate-600">
                DC 最高电压
                <input type="number" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.dcVoltageMax} onChange={(e) => setForm({ ...form, dcVoltageMax: Number(e.target.value) })} />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="text-xs font-medium text-slate-600">
                模组消防
                <select className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" value={form.moduleFireFilter} onChange={(e) => setForm({ ...form, moduleFireFilter: e.target.value as YesNoAll })}>
                  <option value="全部">全部</option>
                  <option value="带消防">带消防</option>
                  <option value="不带消防">不带消防</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                机柜消防
                <select className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" value={form.cabinetFireFilter} onChange={(e) => setForm({ ...form, cabinetFireFilter: e.target.value as YesNoAll })}>
                  <option value="全部">全部</option>
                  <option value="带消防">带消防</option>
                  <option value="不带消防">不带消防</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                接线方式
                <select className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" value={form.lineTypeFilter} onChange={(e) => setForm({ ...form, lineTypeFilter: e.target.value as LineTypeFilter })}>
                  <option value="全部">全部</option>
                  <option value="2线">2线</option>
                  <option value="3线">3线</option>
                </select>
              </label>
            </div>

            <label className="block text-xs font-medium text-slate-600">
              特殊需求 / 备注
              <textarea
                rows={4}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none"
                value={form.specialRequirements}
                onChange={(e) => setForm({ ...form, specialRequirements: e.target.value })}
              />
            </label>

            <div className="flex justify-end">
              <Button onClick={handleApplyConfig}>需求配置确定</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">候选方案清单</h3>
                <p className="text-xs text-slate-400 mt-0.5">更接近真实业务场景：先列出组合结果，再由销售/售前选择。</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info">方案列表</Badge>
                <Button size="sm" variant="primary" icon={<Radar size={14} />} onClick={() => setAnalysisOpen(true)}>AI洞察</Button>
                {canProceedToConfig && (
                  <Button size="sm" icon={<ChevronRight size={14} />} onClick={jumpToConfig}>带入正向选配</Button>
                )}
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">模组数</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">柜数</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Min VDC</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Max VDC</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">备电时长(EOL)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Max 放电电流</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">AI匹配分析状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {skuPlans.map((plan) => {
                  const badge = skuStatusBadge(plan.status);
                  const active = selectedSku?.skuCode === plan.skuCode;
                  return (
                    <tr
                      key={plan.skuCode}
                      className={`cursor-pointer transition-colors ${active ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                      onClick={() => setSelectedSkuCode(plan.skuCode)}
                    >
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{plan.moduleCount}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{plan.cabinetCount}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{(plan.estimatedVoltage - 44.8 * (plan.lineType === '3线' ? 1 : 0.8)).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{plan.estimatedVoltage.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{plan.estimatedEnergyKWh.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{plan.estimatedCurrent.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant={analysisStatusBadge(plan.analysisStatusLabel).variant} icon={analysisStatusBadge(plan.analysisStatusLabel).icon}>
                            {plan.analysisStatusLabel}
                          </Badge>
                          <span className="text-[11px] text-slate-400">{plan.analysisStatusDetail}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal isOpen={analysisOpen} onClose={() => setAnalysisOpen(false)} title="AI 洞察：方案候选分析" size="lg">
        <div className="p-6 space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-slate-900">方案分析详情</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={analysisStatusBadge(selectedSku?.analysisStatusLabel ?? '可直接推进').variant} icon={analysisStatusBadge(selectedSku?.analysisStatusLabel ?? '可直接推进').icon}>
                  {selectedSku?.analysisStatusLabel ?? '可直接推进'}
                </Badge>
                {selectedSku?.recommended && <Badge variant="purple" icon={<Star size={11} />}>推荐方案</Badge>}
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-3">{selectedSku?.analysisSummary}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <ClipboardList size={15} className="text-brand-600" />
                <p className="text-xs font-semibold text-slate-700">步骤 1：方案组合枚举</p>
              </div>
              <p className="text-sm text-slate-900 mt-2">模组候选：{appliedForm.moduleCounts.join(' / ')}</p>
              <p className="text-sm text-slate-900">消防维度：模组 {appliedForm.moduleFireFilter} / 机柜 {appliedForm.cabinetFireFilter}</p>
              <p className="text-xs text-slate-500 mt-2">接线方式：{appliedForm.lineTypeFilter}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <Radar size={15} className="text-purple-600" />
                <p className="text-xs font-semibold text-slate-700">步骤 2：推荐规则</p>
              </div>
              <p className="text-sm text-slate-900 mt-2">优先级：可推进状态 ＞ 柜数更少 ＞ 电流更低 ＞ 时长更贴近目标</p>
              <p className="text-sm text-slate-900">当前选中：{selectedSku?.cabinetCount ?? '-'} 柜</p>

            </div>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3">
            <p className="text-xs font-semibold text-brand-700">系统解析结论</p>
            <ol className="mt-2 space-y-1 text-xs text-brand-700 list-decimal pl-4">
              <li>先根据客户需求锁定推荐产品族。</li>
              <li>围绕模组数、消防、两线/三线枚举一组方案组合。</li>
              <li>按电压范围、电流阈值、海拔与特殊需求打标识，不直接删方案。</li>
              <li>推荐机柜数更少、风险更低的方案优先进入配置与报价。</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-700">逐步推导说明</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc pl-4">
              {(selectedSku?.analysisNotes ?? []).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setAnalysisOpen(false)}>关闭</Button>
            {canProceedToConfig && (
              <Button onClick={() => { setAnalysisOpen(false); jumpToConfig(); }} icon={<ChevronRight size={14} />}>带入正向选配</Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
