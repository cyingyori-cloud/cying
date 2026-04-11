/**
 * Fxiaoke 嵌入式方案展示页面
 * 接收 URL 参数，自动计算并显示方案列表
 * 
 * URL 格式: /fxiaoke?power_kw=420&capacity_kwh=60&backup_min=15&dc_min=520&dc_max=680
 */

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Star } from 'lucide-react';

type YesNoAll = 'ALL' | 'YES' | 'NO';
type LineTypeFilter = 'ALL' | '2线' | '3线';

interface FormData {
  targetPowerKw: number;
  targetEnergyKWh: number;
  backupMinutes: number;
  dcVoltageMin: number;
  dcVoltageMax: number;
  moduleCounts: number[];
  moduleFireFilter: YesNoAll;
  cabinetFireFilter: YesNoAll;
  lineTypeFilter: LineTypeFilter;
}

interface SkuPlan {
  skuCode: string;
  moduleCount: number;
  moduleFire: boolean;
  cabinetFire: boolean;
  lineType: string;
  cabinetCount: number;
  estimatedVoltage: number;
  estimatedCurrent: number;
  estimatedEnergyKWh: number;
  status: 'VALID' | 'WARNING' | 'INVALID';
  warningReasons: string[];
  recommended: boolean;
  pricingTiers: { level1: number; level2: number; level3: number };
  rankScore: number;
  estimatedCost: number;
  analysisStatusLabel: string;
  analysisStatusDetail: string;
}

const REFERENCE_ROWS: Record<number, { rackQty: number; minVdc: number; maxVdc: number }> = {
  8: { rackQty: 4, minVdc: 358.4, maxVdc: 441.6 },
  9: { rackQty: 4, minVdc: 403.2, maxVdc: 496.8 },
  10: { rackQty: 4, minVdc: 448.0, maxVdc: 552.0 },
  11: { rackQty: 3, minVdc: 492.8, maxVdc: 607.2 },
  12: { rackQty: 3, minVdc: 537.6, maxVdc: 662.4 },
};

function buildSkuPlans(form: FormData): SkuPlan[] {
  const moduleFireOptions = form.moduleFireFilter === 'ALL'
    ? [true, false]
    : [form.moduleFireFilter === 'YES'];
  const cabinetFireOptions = form.cabinetFireFilter === 'ALL'
    ? [true, false]
    : [form.cabinetFireFilter === 'YES'];
  const lineTypeOptions = form.lineTypeFilter === 'ALL'
    ? (['2线', '3线'] as const)
    : ([form.lineTypeFilter] as const);

  const rows: SkuPlan[] = [];

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
          const voltageOut = estimatedMinVdc < form.dcVoltageMin || estimatedMaxVdc > form.dcVoltageMax;
          const currentOver = estimatedCurrent > 600;
          const backupShort = estimatedBackupMin < form.backupMinutes * 0.92;

          if (voltageOut) warnings.push(`电压范围 ${estimatedMinVdc}-${estimatedMaxVdc}V 与要求 ${form.dcVoltageMin}-${form.dcVoltageMax}V 不一致`);
          if (currentOver) warnings.push(`放电电流 ${estimatedCurrent}A 超过 600A`);
          if (backupShort) warnings.push(`时长 ${estimatedBackupMin}min 低于目标 ${form.backupMinutes}min`);

          const status: SkuPlan['status'] = (voltageOut || currentOver) ? 'INVALID' : (estimatedCurrent > 560 || backupShort) ? 'WARNING' : 'VALID';

          const demoStatusIndex = (moduleCount + (moduleFire ? 2 : 0) + (lineType === '3线' ? 1 : 0)) % 8;
          const demoLabels = [
            { label: '推荐方案', detail: '柜数更少、边界更稳、适合优先推进' },
            { label: '可直接推进', detail: '电压、电流与时长均在边界内' },
            { label: '时长临界', detail: '备电时长接近目标边界，可作为备选' },
            { label: '电流边界', detail: '已接近 600A 边界' },
            { label: '需补充说明', detail: '需写清客户特殊要求' },
            { label: '需技术确认', detail: '存在技术边界情况' },
            { label: '电压超界', detail: '超出客户要求电压' },
            { label: '超限需复核', detail: '超出关键边界，不建议直接报价' },
          ];
          const demoStatus = demoLabels[demoStatusIndex];

          const baseCost = Math.round(80000 * (moduleCount / 10) * cabinetCount);
          const extraCost = (moduleFire ? 6000 : 0) + (cabinetFire ? 9000 : 0) + (lineType === '3线' ? 3000 : 0);
          const estimatedCost = baseCost + extraCost;

          const rankScore = (
            (status === 'VALID' ? 110 : status === 'WARNING' ? 70 : 24)
            - cabinetCount * 10
            - warnings.length * 6
          );

          rows.push({
            skuCode: `PAI-M${moduleCount}-${moduleFire ? 'MF' : 'MN'}-${cabinetFire ? 'CF' : 'CN'}-${lineType === '2线' ? '2L' : '3L'}`,
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
            pricingTiers: {
              level1: Math.round(estimatedCost * 1.2),
              level2: Math.round(estimatedCost * 1.15),
              level3: Math.round(estimatedCost * 1.1),
            },
            rankScore,
            estimatedCost,
            analysisStatusLabel: demoStatus.label,
            analysisStatusDetail: demoStatus.detail,
          });
        });
      });
    });
  });

  const sorted = rows.sort((a, b) => b.rankScore - a.rankScore);
  if (sorted[0]) {
    sorted[0].recommended = true;
    sorted[0].analysisStatusLabel = '推荐方案';
    sorted[0].analysisStatusDetail = '柜数更少、边界更稳、适合优先推进';
  }
  return sorted.slice(0, 8);
}

function StatusBadge({ status }: { status: SkuPlan['status'] }) {
  const config = {
    VALID: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle2 size={12} /> },
    WARNING: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <AlertTriangle size={12} /> },
    INVALID: { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle size={12} /> },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {c.icon} {status === 'VALID' ? '可推进' : status === 'WARNING' ? '需确认' : '超限'}
    </span>
  );
}

export default function FxiaokeEmbed() {
  const [form, setForm] = useState<FormData>({
    targetPowerKw: 420,
    targetEnergyKWh: 60,
    backupMinutes: 15,
    dcVoltageMin: 520,
    dcVoltageMax: 680,
    moduleCounts: [8, 9, 10, 11],
    moduleFireFilter: 'ALL',
    cabinetFireFilter: 'ALL',
    lineTypeFilter: 'ALL',
  });

  const [appliedForm, setAppliedForm] = useState(form);
  const [loading, setLoading] = useState(true);

  // 解析 URL 参数
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const powerKw = params.get('power_kw');
    const capacityKwh = params.get('capacity_kwh');
    const backupMin = params.get('backup_min');
    const dcMin = params.get('dc_min');
    const dcMax = params.get('dc_max');

    if (powerKw || capacityKwh || backupMin) {
      const newForm = {
        ...form,
        targetPowerKw: powerKw ? parseFloat(powerKw) : form.targetPowerKw,
        targetEnergyKWh: capacityKwh ? parseFloat(capacityKwh) : form.targetEnergyKWh,
        backupMinutes: backupMin ? parseInt(backupMin) : form.backupMinutes,
        dcVoltageMin: dcMin ? parseFloat(dcMin) : form.dcVoltageMin,
        dcVoltageMax: dcMax ? parseFloat(dcMax) : form.dcVoltageMax,
        moduleCounts: [8, 9, 10, 11, 12],
      };
      setForm(newForm);
      setAppliedForm(newForm);
    }
    setLoading(false);

    // 延迟后自动触发计算（如果有参数）
    if (powerKw || capacityKwh || backupMin) {
      const timer = setTimeout(() => {
        setAppliedForm(form);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const skuPlans = useMemo(() => buildSkuPlans(appliedForm), [appliedForm]);
  const recommendedPlan = skuPlans.find(p => p.recommended);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 头部 */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">PowerQuote 方案推荐</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              功率 {appliedForm.targetPowerKw}kW | 容量 {appliedForm.targetEnergyKWh}kWh | 备电 {appliedForm.backupMinutes}min
            </p>
          </div>
          <button
            onClick={() => window.close()}
            className="text-slate-400 hover:text-slate-600 p-2"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 方案列表 */}
      <div className="p-4 space-y-3">
        {/* 推荐方案 */}
        {recommendedPlan && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star size={16} className="text-green-600 fill-green-600" />
              <span className="text-sm font-semibold text-green-800">推荐方案</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">SKU:</span>
                <span className="ml-2 font-mono font-medium text-slate-800">{recommendedPlan.skuCode}</span>
              </div>
              <div>
                <span className="text-slate-500">模组数:</span>
                <span className="ml-2 font-medium text-slate-800">{recommendedPlan.moduleCount} 个</span>
              </div>
              <div>
                <span className="text-slate-500">机柜数:</span>
                <span className="ml-2 font-medium text-slate-800">{recommendedPlan.cabinetCount} 柜</span>
              </div>
              <div>
                <span className="text-slate-500">预估电压:</span>
                <span className="ml-2 font-medium text-slate-800">{recommendedPlan.estimatedVoltage}V</span>
              </div>
              <div>
                <span className="text-slate-500">预估电流:</span>
                <span className="ml-2 font-medium text-slate-800">{recommendedPlan.estimatedCurrent}A</span>
              </div>
              <div>
                <span className="text-slate-500">预估成本:</span>
                <span className="ml-2 font-medium text-green-700">¥{recommendedPlan.estimatedCost.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-600 bg-white/60 rounded-lg p-2">
              {recommendedPlan.analysisStatusDetail}
            </div>
          </div>
        )}

        {/* 其他方案 */}
        {skuPlans.filter(p => !p.recommended).map((plan, idx) => (
          <div
            key={idx}
            className={`bg-white border rounded-xl p-4 ${
              plan.status === 'INVALID' ? 'border-red-200' :
              plan.status === 'WARNING' ? 'border-yellow-200' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-slate-800">{plan.skuCode}</span>
                <StatusBadge status={plan.status} />
              </div>
              <span className="text-sm font-semibold text-slate-700">
                ¥{plan.estimatedCost.toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs text-slate-600">
              <div>模组: {plan.moduleCount}</div>
              <div>机柜: {plan.cabinetCount}</div>
              <div>电压: {plan.estimatedVoltage}V</div>
              <div>电流: {plan.estimatedCurrent}A</div>
            </div>
            {plan.warningReasons.length > 0 && (
              <div className="mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                ⚠️ {plan.warningReasons.join('; ')}
              </div>
            )}
          </div>
        ))}

        {skuPlans.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            请先在表单中填写需求参数
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
        <button
          onClick={() => window.close()}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
