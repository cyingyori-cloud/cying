import { useMemo, useState } from 'react';
import {
  FileText, Search, Plus, Eye, CheckCircle, XCircle,
  Clock, AlertCircle, Download, Filter, Link2, ShieldAlert, BriefcaseBusiness, Cpu, Boxes, Sparkles, Printer,
} from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { QuoteInsightPanel } from '../components/quotes/QuoteInsightPanel';
import { demoDataNotice } from '../data/mockData';
import { roleViewMap } from '../data/roleViews';
import { useAppStore } from '../store/appStore';
import type { Quotation, QuoteStatus } from '../types';
import {
  approveQuotationFlow,
  getApprovalHeadline,
  getCurrentApprovalStep,
  rejectQuotationFlow,
  submitQuotationFlow,
} from '../utils/approvalFlow';
import { buildQuoteInsight } from '../utils/quoteInsights';

const statusConfig: Record<QuoteStatus, {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'purple';
  icon: React.ReactNode;
}> = {
  DRAFT: { label: '草稿', variant: 'default', icon: <AlertCircle size={13} /> },
  SUBMITTED: { label: '待审批', variant: 'info', icon: <Clock size={13} /> },
  APPROVED: { label: '已审批', variant: 'success', icon: <CheckCircle size={13} /> },
  REJECTED: { label: '已驳回', variant: 'danger', icon: <XCircle size={13} /> },
  EXPIRED: { label: '已过期', variant: 'warning', icon: <AlertCircle size={13} /> },
};

function formatCurrency(value: number) {
  if (value >= 10000) return `¥${(value / 10000).toFixed(2)}万`;
  return `¥${value.toLocaleString()}`;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

function printQuotation(quotation: Quotation) {
  const printWindow = window.open('', '_blank', 'width=980,height=760');
  if (!printWindow) return;

  const grossProfit = quotation.totalPrice - quotation.totalCost;
  const grossProfitRate = quotation.grossProfitRate ?? 0;

  const content = `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <title>${quotation.quoteNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e293b; padding: 32px; }
          h1 { font-size: 24px; margin: 0 0 8px; }
          h2 { font-size: 16px; margin: 24px 0 10px; }
          .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
          .label { color: #64748b; font-size: 12px; margin-bottom: 6px; }
          .value { font-size: 15px; font-weight: 600; }
          .summary { border: 1px solid #dbeafe; background: #eff6ff; border-radius: 12px; padding: 14px; margin-top: 16px; }
          .remark { border: 1px solid #fde68a; background: #fffbeb; border-radius: 12px; padding: 14px; margin-top: 16px; }
          @media print { body { padding: 0; } button { display: none; } }
        </style>
      </head>
      <body>
        <h1>报价单打印稿</h1>
        <div class="meta">${quotation.quoteNumber} | ${quotation.customerName ?? '未指定客户'}</div>

        <div class="grid">
          <div class="card"><div class="label">关联商机</div><div class="value">${quotation.linkedOpportunity ?? '—'}</div></div>
          <div class="card"><div class="label">项目名称</div><div class="value">${quotation.projectName ?? '—'}</div></div>
          <div class="card"><div class="label">报价金额</div><div class="value">¥${quotation.totalPrice.toLocaleString()}</div></div>
          <div class="card"><div class="label">成本</div><div class="value">¥${quotation.totalCost.toLocaleString()}</div></div>
          <div class="card"><div class="label">毛利润</div><div class="value">¥${grossProfit.toLocaleString()}</div></div>
          <div class="card"><div class="label">毛利率</div><div class="value">${(grossProfitRate * 100).toFixed(1)}%</div></div>
          <div class="card"><div class="label">创建人</div><div class="value">${quotation.createdBy ?? '—'}</div></div>
          <div class="card"><div class="label">有效期至</div><div class="value">${quotation.validUntil ?? '—'}</div></div>
        </div>

        ${quotation.solutionSummary ? `<div class="summary"><div class="label">方案摘要</div><div class="value">${quotation.solutionSummary}</div></div>` : ''}
        ${quotation.remarks ? `<div class="remark"><div class="label">备注</div><div class="value">${quotation.remarks}</div></div>` : ''}
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(content);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export function QuotationList() {
  const { quotations, updateQuotation, setActiveTab, currentRole } = useAppStore();
  const roleInfo = roleViewMap[currentRole];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'ALL'>('ALL');
  const [viewQuote, setViewQuote] = useState<Quotation | null>(null);
  const [insightQuote, setInsightQuote] = useState<Quotation | null>(null);

  const filteredQuotations = quotations.filter((quotation) => {
    const matchSearch = !search
      || quotation.quoteNumber.includes(search)
      || (quotation.customerName ?? '').includes(search)
      || (quotation.projectName ?? '').includes(search)
      || (quotation.linkedOpportunity ?? '').includes(search);
    const matchStatus = statusFilter === 'ALL' || quotation.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = filteredQuotations.reduce((sum, quotation) => sum + quotation.totalPrice, 0);
  const totalCost = filteredQuotations.reduce((sum, quotation) => sum + quotation.totalCost, 0);
  const approvedCount = filteredQuotations.filter((quotation) => quotation.status === 'APPROVED').length;
  const pendingCount = filteredQuotations.filter((quotation) => quotation.status === 'SUBMITTED').length;
  const draftCount = filteredQuotations.filter((quotation) => quotation.status === 'DRAFT').length;
  const rejectedCount = filteredQuotations.filter((quotation) => quotation.status === 'REJECTED').length;
  const syncedCount = filteredQuotations.filter((quotation) => quotation.sourceSystem === '纷享销客CRM').length;
  const lowMarginQuotes = filteredQuotations.filter((quotation) => (quotation.grossProfitRate ?? 0) < 0.16);
  const avgGrossProfit = filteredQuotations.length > 0
    ? filteredQuotations.reduce((sum, quotation) => sum + (quotation.grossProfitRate ?? 0), 0) / filteredQuotations.length
    : 0;
  const canCreateQuote = currentRole === 'sales' || currentRole === 'presales';
  const canSubmitDraft = currentRole === 'sales' || currentRole === 'presales';
  const canApprove = currentRole === 'approver';
  const showCostColumn = currentRole !== 'sales';
  const showMarginColumn = currentRole !== 'sales';
  const showSolutionColumn = currentRole !== 'executive';

  const summaryCards = currentRole === 'executive'
    ? [
      { label: '报价总额', value: formatCurrency(totalRevenue), color: 'text-blue-600', bg: 'bg-blue-50', icon: <FileText size={16} className="text-blue-600" /> },
      { label: '待审批金额', value: formatCurrency(filteredQuotations.filter((quotation) => quotation.status === 'SUBMITTED').reduce((sum, quotation) => sum + quotation.totalPrice, 0)), color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <Clock size={16} className="text-emerald-600" /> },
      { label: '平均毛利率', value: `${(avgGrossProfit * 100).toFixed(1)}%`, color: 'text-purple-600', bg: 'bg-purple-50', icon: <ShieldAlert size={16} className="text-purple-600" /> },
      { label: '低毛利报价', value: lowMarginQuotes.length, color: 'text-amber-600', bg: 'bg-amber-50', icon: <AlertCircle size={16} className="text-amber-600" /> },
    ]
    : currentRole === 'sales'
      ? [
        { label: '待跟进报价', value: draftCount + pendingCount, color: 'text-blue-600', bg: 'bg-blue-50', icon: <BriefcaseBusiness size={16} className="text-blue-600" /> },
        { label: '同步商机数', value: syncedCount, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <Link2 size={16} className="text-emerald-600" /> },
        { label: '已审批可回传', value: approvedCount, color: 'text-purple-600', bg: 'bg-purple-50', icon: <CheckCircle size={16} className="text-purple-600" /> },
        { label: '已驳回待修正', value: rejectedCount, color: 'text-amber-600', bg: 'bg-amber-50', icon: <XCircle size={16} className="text-amber-600" /> },
      ]
      : currentRole === 'presales'
        ? [
          { label: '方案支撑报价', value: filteredQuotations.length, color: 'text-blue-600', bg: 'bg-blue-50', icon: <Cpu size={16} className="text-blue-600" /> },
          { label: '平均成本', value: formatCurrency(totalCost), color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <FileText size={16} className="text-emerald-600" /> },
          { label: '待验证审批', value: pendingCount, color: 'text-purple-600', bg: 'bg-purple-50', icon: <Clock size={16} className="text-purple-600" /> },
          { label: '复杂方案样本', value: filteredQuotations.filter((quotation) => (quotation.solutionSummary?.split('/').length ?? 0) >= 3).length, color: 'text-amber-600', bg: 'bg-amber-50', icon: <ShieldAlert size={16} className="text-amber-600" /> },
        ]
        : currentRole === 'product'
          ? [
            { label: '有效报价样本', value: filteredQuotations.length, color: 'text-blue-600', bg: 'bg-blue-50', icon: <Boxes size={16} className="text-blue-600" /> },
            { label: '同步商机数', value: syncedCount, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <Link2 size={16} className="text-emerald-600" /> },
            { label: '已审批样本', value: approvedCount, color: 'text-purple-600', bg: 'bg-purple-50', icon: <CheckCircle size={16} className="text-purple-600" /> },
            { label: '驳回反馈样本', value: rejectedCount, color: 'text-amber-600', bg: 'bg-amber-50', icon: <XCircle size={16} className="text-amber-600" /> },
          ]
          : [
            { label: '待审批报价', value: pendingCount, color: 'text-blue-600', bg: 'bg-blue-50', icon: <Clock size={16} className="text-blue-600" /> },
            { label: '待审批金额', value: formatCurrency(filteredQuotations.filter((quotation) => quotation.status === 'SUBMITTED').reduce((sum, quotation) => sum + quotation.totalPrice, 0)), color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <TrendingBadge /> },
            { label: '低毛利报价', value: lowMarginQuotes.length, color: 'text-purple-600', bg: 'bg-purple-50', icon: <ShieldAlert size={16} className="text-purple-600" /> },
            { label: '已驳回报价', value: rejectedCount, color: 'text-amber-600', bg: 'bg-amber-50', icon: <XCircle size={16} className="text-amber-600" /> },
          ];

  const introText = currentRole === 'executive'
    ? '老板视角建议优先看金额、毛利率和重点项目状态。'
    : currentRole === 'sales'
      ? '销售视角建议优先看待跟进商机和可回传客户方案。'
      : currentRole === 'presales'
        ? '售前视角建议优先看方案复杂度、成本和审批卡点。'
        : currentRole === 'product'
          ? '产品视角建议优先看哪些报价正在形成可复用样本。'
          : '审批视角建议优先看低毛利和待审批金额。';

  const detailInsight = useMemo(() => {
    if (!viewQuote) return null;
    const grossProfitRate = viewQuote.grossProfitRate ?? 0;

    if (currentRole === 'executive') {
      return {
        title: '经营视角',
        body: grossProfitRate < 0.16
          ? '该报价毛利率偏低，建议结合客户战略价值与交付难度一起判断。'
          : '该报价毛利率处于可接受区间，重点关注是否属于关键项目。 ',
        tone: grossProfitRate < 0.16 ? 'danger' : 'info',
      };
    }

    if (currentRole === 'sales') {
      return {
        title: '销售视角',
        body: `当前最适合对客户输出的是“${viewQuote.solutionSummary ?? '标准方案摘要'}”，审批通过后可直接回传。`,
        tone: 'info',
      };
    }

    if (currentRole === 'presales') {
      return {
        title: '售前视角',
        body: `当前方案摘要为“${viewQuote.solutionSummary ?? '未生成摘要'}”，建议结合规则页与 BOM 页进行二次复核。`,
        tone: 'purple',
      };
    }

    if (currentRole === 'product') {
      return {
        title: '产品视角',
        body: '这张报价单可以作为产品口径和规则反馈样本，适合沉淀到型号与规则资产中。',
        tone: 'success',
      };
    }

    return {
      title: '审批建议',
      body: grossProfitRate < 0.16
        ? '建议升级审批，核查是否存在特殊折扣、交付风险或战略项目原因。'
        : '可按标准路径审批，重点确认报价摘要与商机信息是否一致。',
      tone: grossProfitRate < 0.16 ? 'danger' : 'success',
    };
  }, [currentRole, viewQuote]);

  const handleApprove = (quotation: Quotation) => {
    updateQuotation(approveQuotationFlow(quotation));
    setViewQuote(null);
  };

  const handleReject = (quotation: Quotation) => {
    updateQuotation(rejectQuotationFlow(quotation));
    setViewQuote(null);
  };

  const handleSubmit = (quotation: Quotation) => {
    updateQuotation(submitQuotationFlow(quotation));
    setViewQuote(null);
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <Link2 size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{roleInfo.label}下的报价管理</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{introText}</p>
            <p className="text-[11px] text-slate-400 mt-2">{demoDataNotice}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className={`inline-flex p-2 rounded-lg mb-2 ${stat.bg}`}>
              {stat.icon}
            </div>
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-500">{stat.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索报价单号、商机号、客户名称、项目名称..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                />
              </div>
              {canCreateQuote && (
                <Button icon={<Plus size={16} />} onClick={() => setActiveTab('quotations-cpq')} size="sm">
                  新建 CPQ 报价
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={13} className="text-slate-400" />
              <span className="text-xs text-slate-400">状态筛选：</span>
              {(['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {status === 'ALL' ? '全部' : statusConfig[status].label}
                </button>
              ))}
            </div>

            {filteredQuotations.length !== quotations.length && (
              <p className="text-xs text-slate-400">
                显示 {filteredQuotations.length} / {quotations.length} 条，筛选报价额合计：{formatCurrency(totalRevenue)}
              </p>
            )}
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">报价单号</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">商机 / 客户</th>
                {showSolutionColumn && (
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">方案摘要</th>
                )}
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">报价金额</th>
                {showCostColumn && (
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">成本</th>
                )}
                {showMarginColumn && (
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">毛利率</th>
                )}
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">状态</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">创建日期</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredQuotations.map((quotation) => {
                const status = statusConfig[quotation.status];
                const isRisky = (quotation.grossProfitRate ?? 0) < 0.16;

                return (
                  <tr key={quotation.id} className={`hover:bg-slate-50/50 transition-colors ${currentRole === 'approver' && isRisky ? 'bg-red-50/40' : ''}`}>
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-mono text-xs text-slate-600">{quotation.quoteNumber}</span>
                        <p className="text-[11px] text-slate-400 mt-1">{quotation.sourceSystem ?? '手工录入'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-900">{quotation.customerName ?? '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px]">{quotation.linkedOpportunity ?? '未绑定商机'}</p>
                    </td>
                    {showSolutionColumn && (
                      <td className="px-6 py-4">
                        <div className="max-w-[220px]">
                          <Badge variant="info">CPQ 智能报价</Badge>
                          {quotation.solutionSummary && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{quotation.solutionSummary}</p>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-slate-900">{formatCurrency(quotation.totalPrice)}</span>
                    </td>
                    {showCostColumn && (
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-slate-500">{formatCurrency(quotation.totalCost)}</span>
                      </td>
                    )}
                    {showMarginColumn && (
                      <td className="px-6 py-4 text-center">
                        {quotation.grossProfitRate != null ? (
                          <span className={`text-sm font-semibold ${isRisky ? 'text-red-500' : 'text-emerald-600'}`}>
                            {(quotation.grossProfitRate * 100).toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    <td className="px-6 py-4 text-center">
                      <Badge variant={status.variant}>
                        <span className="flex items-center gap-1">{status.icon}{status.label}</span>
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs text-slate-500">{formatDate(quotation.createdAt)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewQuote(quotation)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                          title="查看详情"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => setInsightQuote(quotation)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-500 hover:bg-purple-50 transition-colors"
                          title="AI分析"
                        >
                          <Sparkles size={14} />
                        </button>
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                          title="导出PDF"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => printQuotation(quotation)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="打印"
                        >
                          <Printer size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredQuotations.length === 0 && (
            <div className="py-16 text-center text-slate-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>暂无符合条件的报价单</p>
            </div>
          )}
        </div>
      </Card>

      <Modal isOpen={!!viewQuote} onClose={() => setViewQuote(null)} title="报价单详情" size="lg">
        {viewQuote && (() => {
          const status = statusConfig[viewQuote.status];
          const grossProfitRate = viewQuote.grossProfitRate ?? 0;
          const grossProfit = viewQuote.totalPrice - viewQuote.totalCost;
          const currentStep = getCurrentApprovalStep(viewQuote);

          return (
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm text-slate-400">{viewQuote.quoteNumber}</p>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">{viewQuote.customerName ?? '未指定客户'}</h3>
                  {viewQuote.projectName && <p className="text-sm text-slate-500 mt-0.5">项目：{viewQuote.projectName}</p>}
                </div>
                <Badge variant={status.variant} className="text-sm px-3 py-1">
                  <span className="flex items-center gap-1.5">{status.icon}{status.label}</span>
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-2xl p-4 text-center">
                  <p className="text-xs text-blue-400 mb-1">报价金额</p>
                  <p className="text-2xl font-bold text-blue-700">¥{viewQuote.totalPrice.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">物料成本</p>
                  <p className="text-2xl font-bold text-slate-700">¥{viewQuote.totalCost.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                  <p className="text-xs text-emerald-400 mb-1">毛利润</p>
                  <p className="text-2xl font-bold text-emerald-700">¥{grossProfit.toLocaleString()}</p>
                  <p className={`text-xs ${(grossProfitRate < 0.16) ? 'text-red-500' : 'text-emerald-500'}`}>{(grossProfitRate * 100).toFixed(1)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: '报价类型', value: 'CPQ 智能报价' },
                  { label: '来源系统', value: viewQuote.sourceSystem ?? '手工录入' },
                  { label: '关联商机', value: viewQuote.linkedOpportunity ?? '—' },
                  { label: '商机负责人', value: viewQuote.opportunityOwner ?? '—' },
                  { label: '联系方式', value: viewQuote.customerContact ?? '—' },
                  { label: '有效期至', value: viewQuote.validUntil ?? '—' },
                  { label: '创建人', value: viewQuote.createdBy ?? '—' },
                  { label: '创建时间', value: formatDate(viewQuote.createdAt) },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50 rounded-xl px-4 py-3">
                    <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
                    <p className="font-medium text-slate-800 break-all">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-3">
                <div>
                  <p className="text-xs text-slate-400">当前审批节点</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{currentStep?.stepName ?? '审批流程已结束'}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentStep ? `当前审批人：${currentStep.approverName} / ${currentStep.approverRole}` : getApprovalHeadline(viewQuote)}
                  </p>
                </div>
                <div className="space-y-2">
                  {viewQuote.approvalSteps?.map((step) => (
                    <div key={step.id} className="flex items-start gap-3 rounded-xl bg-white px-3 py-3">
                      <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                        step.status === 'DONE'
                          ? 'bg-emerald-500 text-white'
                          : step.status === 'CURRENT'
                            ? 'bg-blue-600 text-white'
                            : step.status === 'REJECTED'
                              ? 'bg-red-500 text-white'
                              : 'bg-slate-100 text-slate-400'
                      }`}>
                        {step.id % 10}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-900">{step.stepName}</p>
                          <Badge variant={
                            step.status === 'DONE' ? 'success'
                              : step.status === 'CURRENT' ? 'info'
                                : step.status === 'REJECTED' ? 'danger'
                                  : 'default'
                          }>
                            {step.status === 'DONE' ? '已完成'
                              : step.status === 'CURRENT' ? '当前节点'
                                : step.status === 'REJECTED' ? '已驳回'
                                  : '未到达'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{step.approverName} / {step.approverRole}</p>
                        {step.actedAt && <p className="text-[11px] text-slate-400 mt-1">{formatDate(step.actedAt)} {step.actedAt.slice(11, 16)}</p>}
                        {step.comment && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{step.comment}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {detailInsight && (
                <div className={`rounded-xl px-4 py-3 ${
                  detailInsight.tone === 'danger' ? 'bg-red-50 text-red-800'
                    : detailInsight.tone === 'success' ? 'bg-emerald-50 text-emerald-800'
                      : detailInsight.tone === 'purple' ? 'bg-purple-50 text-purple-800'
                        : 'bg-blue-50 text-blue-900'
                }`}>
                  <p className="text-xs font-semibold">{detailInsight.title}</p>
                  <p className="text-sm mt-1 leading-relaxed">{detailInsight.body}</p>
                </div>
              )}

              <QuoteInsightPanel insight={buildQuoteInsight(viewQuote, currentRole)} />

              {viewQuote.solutionSummary && (
                <div className="bg-blue-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-blue-400 mb-0.5">方案摘要</p>
                  <p className="text-sm text-blue-900">{viewQuote.solutionSummary}</p>
                </div>
              )}

              {viewQuote.remarks && (
                <div className="bg-amber-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-400 mb-0.5">备注</p>
                  <p className="text-sm text-amber-800">{viewQuote.remarks}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setViewQuote(null)}>
                  关闭
                </Button>
                <Button variant="outline" icon={<Printer size={15} />} onClick={() => printQuotation(viewQuote)}>
                  打印
                </Button>
                {viewQuote.status === 'DRAFT' && canSubmitDraft && (
                  <Button className="flex-1" onClick={() => handleSubmit(viewQuote)}>
                    提交审批
                  </Button>
                )}
                {viewQuote.status === 'SUBMITTED' && canApprove && (
                  <>
                    <Button variant="danger" className="flex-1" onClick={() => handleReject(viewQuote)}>
                      驳回
                    </Button>
                    <Button className="flex-1" onClick={() => handleApprove(viewQuote)}>
                      审批通过
                    </Button>
                  </>
                )}
                <Button variant="outline" icon={<Download size={15} />}>
                  导出PDF
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={!!insightQuote} onClose={() => setInsightQuote(null)} title="AI 洞察" size="lg">
        {insightQuote && (
          <div className="p-6 space-y-4">
            <div>
              <p className="font-mono text-sm text-slate-400">{insightQuote.quoteNumber}</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{insightQuote.customerName ?? '未指定客户'}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{insightQuote.projectName ?? insightQuote.linkedOpportunity ?? '未命名项目'}</p>
            </div>
            <QuoteInsightPanel insight={buildQuoteInsight(insightQuote, currentRole)} />
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setInsightQuote(null)}>关闭</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TrendingBadge() {
  return <FileText size={16} className="text-emerald-600" />;
}
