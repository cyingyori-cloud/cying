import { useMemo, useState } from 'react';
import {
  ArrowRightLeft, CheckCircle2, Clock3, DollarSign, Link2, PackageSearch, ShieldAlert, Workflow,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../store/appStore';
import { roleViewMap } from '../data/roleViews';

interface MappingRecord {
  id: number;
  salesProduct: string;
  scenario: string;
  internalMaterial: string;
  bomVersion: string;
  mappingStatus: 'AI_DRAFT' | 'PM_CONFIRMED' | 'WAIT_PROCUREMENT' | 'WAIT_FINANCE' | 'COST_READY';
  aiHint: string;
  procurementStatus: string;
  financeStatus: string;
  estimatedCost: number;
  targetPrice: number;
}

const initialMappings: MappingRecord[] = [
  {
    id: 1,
    salesProduct: 'PU200 AI 算力中心高倍率备电柜',
    scenario: 'AIDC / 10C 备电',
    internalMaterial: 'PU200-10C / 半固态高功率输出模块 / BMS 热插拔控制器',
    bomVersion: 'PU200-BOM-V3.2',
    mappingStatus: 'WAIT_PROCUREMENT',
    aiHint: 'AI 推荐销售产品映射到 3 个核心物料族，并建议优先确认半固态模组和高倍率输出模块。',
    procurementStatus: '采购已回填模组询价，仍缺北美交付辅材价格。',
    financeStatus: '待成本会计确认服务分摊。',
    estimatedCost: 505000,
    targetPrice: 620000,
  },
  {
    id: 2,
    salesProduct: 'UniC DG500 大型工商业储能柜',
    scenario: '需求侧响应 / 虚拟电厂',
    internalMaterial: 'DG500 电池簇 / 站级消防联动 / 8 台直流并联包',
    bomVersion: 'DG500-BOM-V2.8',
    mappingStatus: 'WAIT_FINANCE',
    aiHint: 'AI 判断当前销售口径需映射到 1 对多物料，并提示物流/安装费不可遗漏。',
    procurementStatus: '采购询价完成。',
    financeStatus: '财务待确认站级调试包和物流分摊。',
    estimatedCost: 914000,
    targetPrice: 1080000,
  },
  {
    id: 3,
    salesProduct: 'UniC AG300-150 工商业储能柜',
    scenario: '园区峰谷套利 / 光储充',
    internalMaterial: 'AG300 电池系统 / PCS / Pack 级消防 / EMS 接入包',
    bomVersion: 'AG300-BOM-V4.1',
    mappingStatus: 'COST_READY',
    aiHint: 'AI 已完成物料映射，建议直接生成指导价并进入授权审批。',
    procurementStatus: '询价完成。',
    financeStatus: '成本会计已确认项目级费用分摊。',
    estimatedCost: 580500,
    targetPrice: 706000,
  },
];

function statusMeta(status: MappingRecord['mappingStatus']) {
  switch (status) {
    case 'AI_DRAFT':
      return { variant: 'purple' as const, label: 'AI草稿' };
    case 'PM_CONFIRMED':
      return { variant: 'info' as const, label: '产品经理确认' };
    case 'WAIT_PROCUREMENT':
      return { variant: 'warning' as const, label: '待采购询价' };
    case 'WAIT_FINANCE':
      return { variant: 'warning' as const, label: '待财务分摊' };
    default:
      return { variant: 'success' as const, label: '成本已齐套' };
  }
}

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`;
}

export function MappingWorkbench() {
  const { setActiveTab, currentRole } = useAppStore();
  const roleInfo = roleViewMap[currentRole];
  const canAdvance = currentRole === 'product';
  const canViewBom = currentRole === 'product';
  const [rows, setRows] = useState(initialMappings);

  const readyCount = rows.filter((row) => row.mappingStatus === 'COST_READY').length;
  const waitingCost = rows.filter((row) => row.mappingStatus === 'WAIT_PROCUREMENT' || row.mappingStatus === 'WAIT_FINANCE').length;
  const averageMargin = rows.length > 0
    ? rows.reduce((sum, row) => sum + ((row.targetPrice - row.estimatedCost) / row.targetPrice), 0) / rows.length
    : 0;

  const advanceRow = (id: number) => {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      const next = row.mappingStatus === 'AI_DRAFT'
        ? 'PM_CONFIRMED'
        : row.mappingStatus === 'PM_CONFIRMED'
          ? 'WAIT_PROCUREMENT'
          : row.mappingStatus === 'WAIT_PROCUREMENT'
            ? 'WAIT_FINANCE'
            : 'COST_READY';
      return { ...row, mappingStatus: next };
    }));
  };

  const pendingRows = useMemo(() => rows.filter((row) => row.mappingStatus !== 'COST_READY'), [rows]);

  return (
    <div className="p-6 space-y-4">
      <Card className="border border-brand-100 bg-brand-50/60">
        <CardBody className="p-5">
          <div className="flex items-start gap-3">
            <Workflow size={18} className="text-brand-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{roleInfo.label}下的映射与成本协同台</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                对应报告里最核心的 P0 缺口：把销售产品映射到内部物料/BOM，并把采购、财务、成本会计的补录动作串起来。
              </p>
              {!canAdvance && (
                <p className="text-[11px] text-slate-400 mt-2">当前角色只读查看映射与成本协同结果，不可推进任务节点。</p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="inline-flex rounded-xl bg-brand-50 p-2 text-brand-600"><PackageSearch size={16} /></div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{rows.length}</p>
          <p className="text-xs text-slate-500 mt-1">销售产品映射任务</p>
        </Card>
        <Card className="p-4">
          <div className="inline-flex rounded-xl bg-amber-50 p-2 text-amber-600"><Clock3 size={16} /></div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{waitingCost}</p>
          <p className="text-xs text-slate-500 mt-1">待补齐成本链路</p>
        </Card>
        <Card className="p-4">
          <div className="inline-flex rounded-xl bg-emerald-50 p-2 text-emerald-600"><CheckCircle2 size={16} /></div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{readyCount}</p>
          <p className="text-xs text-slate-500 mt-1">可直接进入指导价</p>
        </Card>
        <Card className="p-4">
          <div className="inline-flex rounded-xl bg-purple-50 p-2 text-purple-600"><DollarSign size={16} /></div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{(averageMargin * 100).toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">映射后平均毛利率</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">销售产品到内部物料/BOM</h3>
                <p className="text-xs text-slate-400 mt-0.5">AI 先给映射草稿，再由产品经理确认，最后流转给采购和财务。</p>
              </div>
              {canViewBom && (
                <Button size="sm" variant="outline" icon={<Link2 size={14} />} onClick={() => setActiveTab('products-bom')}>查看 BOM</Button>
              )}
            </div>
          </CardHeader>
          <div className="divide-y divide-slate-50">
            {rows.map((row) => {
              const badge = statusMeta(row.mappingStatus);
              return (
                <div key={row.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900">{row.salesProduct}</p>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{row.scenario}</p>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{row.internalMaterial}</p>
                      <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-500">AI 映射说明</p>
                        <p className="text-sm text-slate-700 mt-1">{row.aiHint}</p>
                      </div>
                    </div>
                    <div className="w-44 shrink-0 text-right">
                      <p className="text-xs text-slate-400">BOM 版本</p>
                      <p className="text-sm font-medium text-slate-800">{row.bomVersion}</p>
                      <p className="text-xs text-slate-400 mt-3">指导价建议</p>
                      <p className="text-sm font-semibold text-brand-600">{formatCurrency(row.targetPrice)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                      <p className="text-xs text-slate-400">采购询价状态</p>
                      <p className="text-sm text-slate-800 mt-1">{row.procurementStatus}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                      <p className="text-xs text-slate-400">财务/成本状态</p>
                      <p className="text-sm text-slate-800 mt-1">{row.financeStatus}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-slate-400">当前估算成本</p>
                        <p className="text-sm font-semibold text-slate-900 mt-1">{formatCurrency(row.estimatedCost)}</p>
                      </div>
                      {canAdvance && row.mappingStatus !== 'COST_READY' && (
                        <Button size="sm" className="mt-3" onClick={() => advanceRow(row.id)}>推进下一步</Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">协同原则</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">核心缺口</p>
                <p className="text-xs text-red-700 mt-1">没有这条销售产品到物料/BOM 的映射确认链，报价就只是前台演示，不是可交付系统。</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-700">软协同</p>
                <p className="text-xs text-amber-700 mt-1">AI 先给映射草稿，但最终仍需产品经理确认，并由采购/财务补齐成本。</p>
              </div>
              <div className="rounded-2xl bg-brand-50 p-4">
                <p className="text-sm font-semibold text-brand-700">输出结果</p>
                <p className="text-xs text-brand-700 mt-1">当成本齐套后，再进入指导价、审批路径和 CRM 状态回写。</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">待处理队列</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {pendingRows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{row.salesProduct}</p>
                    <Badge variant={statusMeta(row.mappingStatus).variant}>{statusMeta(row.mappingStatus).label}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{row.procurementStatus}</p>
                  <p className="text-xs text-slate-500 mt-1">{row.financeStatus}</p>
                </div>
              ))}
              {pendingRows.length === 0 && (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  当前映射任务都已完成成本齐套，可以进入指导价与审批。
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
