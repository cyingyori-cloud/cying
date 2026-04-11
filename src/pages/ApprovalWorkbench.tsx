import { useMemo, useState } from 'react';
import {
  CheckCircle, Clock, ShieldAlert, XCircle, Eye, AlertTriangle, Link2, Sparkles,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { QuoteInsightPanel } from '../components/quotes/QuoteInsightPanel';
import { useAppStore } from '../store/appStore';
import type { Quotation } from '../types';
import { approveQuotationFlow, getApprovalHeadline, getCurrentApprovalStep, rejectQuotationFlow } from '../utils/approvalFlow';
import { buildQuoteInsight } from '../utils/quoteInsights';

function formatCurrency(value: number) {
  if (value >= 10000) return `¥${(value / 10000).toFixed(2)}万`;
  return `¥${value.toLocaleString()}`;
}

export function ApprovalWorkbench() {
  const { quotations, updateQuotation } = useAppStore();
  const [viewQuote, setViewQuote] = useState<Quotation | null>(null);
  const [insightQuote, setInsightQuote] = useState<Quotation | null>(null);

  const pendingQuotes = useMemo(
    () => quotations.filter((quotation) => quotation.status === 'SUBMITTED'),
    [quotations],
  );
  const riskyQuotes = useMemo(
    () => pendingQuotes.filter((quotation) => (quotation.grossProfitRate ?? 0) < 0.16),
    [pendingQuotes],
  );
  const pendingAmount = pendingQuotes.reduce((sum, quotation) => sum + quotation.totalPrice, 0);
  const avgGrossProfit = pendingQuotes.length > 0
    ? pendingQuotes.reduce((sum, quotation) => sum + (quotation.grossProfitRate ?? 0), 0) / pendingQuotes.length
    : 0;

  const approvalQueue = [...pendingQuotes].sort((a, b) => {
    const marginDiff = (a.grossProfitRate ?? 0) - (b.grossProfitRate ?? 0);
    if (marginDiff !== 0) return marginDiff;
    return b.totalPrice - a.totalPrice;
  });

  const handleApprove = (quotation: Quotation) => {
    updateQuotation(approveQuotationFlow(quotation));
    setViewQuote(null);
  };

  const handleReject = (quotation: Quotation) => {
    updateQuotation(rejectQuotationFlow(quotation));
    setViewQuote(null);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="inline-flex rounded-xl bg-blue-50 p-2 text-blue-600"><Clock size={16} /></div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{pendingQuotes.length}</p>
          <p className="text-xs text-slate-500 mt-1">待审批报价单</p>
        </Card>
        <Card className="p-4">
          <div className="inline-flex rounded-xl bg-emerald-50 p-2 text-emerald-600"><CheckCircle size={16} /></div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{formatCurrency(pendingAmount)}</p>
          <p className="text-xs text-slate-500 mt-1">待审批金额</p>
        </Card>
        <Card className="p-4">
          <div className="inline-flex rounded-xl bg-red-50 p-2 text-red-600"><ShieldAlert size={16} /></div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{riskyQuotes.length}</p>
          <p className="text-xs text-slate-500 mt-1">低毛利重点审查</p>
        </Card>
        <Card className="p-4">
          <div className="inline-flex rounded-xl bg-amber-50 p-2 text-amber-600"><AlertTriangle size={16} /></div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{(avgGrossProfit * 100).toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">待审批平均毛利率</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">审批队列</h3>
                <p className="text-xs text-slate-400 mt-0.5">系统按毛利率和金额综合排序，方便审批人优先处理高风险报价。</p>
              </div>
              <Badge variant="danger">优先处理低毛利</Badge>
            </div>
          </CardHeader>
          <div className="divide-y divide-slate-50">
            {approvalQueue.map((quotation) => {
              const risky = (quotation.grossProfitRate ?? 0) < 0.16;
              const currentStep = getCurrentApprovalStep(quotation);
              return (
                <div key={quotation.id} className={`px-6 py-4 flex items-center gap-4 ${risky ? 'bg-red-50/40' : 'hover:bg-slate-50'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${risky ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                    {risky ? <ShieldAlert size={16} /> : <Clock size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 truncate">{quotation.customerName}</p>
                      <Badge variant={risky ? 'danger' : 'info'}>{risky ? '重点审查' : '标准审批'}</Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 truncate">{quotation.linkedOpportunity ?? quotation.quoteNumber}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {currentStep ? `当前节点：${currentStep.stepName} / ${currentStep.approverName}` : getApprovalHeadline(quotation)}
                    </p>
                    {quotation.solutionSummary && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{quotation.solutionSummary}</p>}
                  </div>
                  <div className="text-right min-w-[110px]">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(quotation.totalPrice)}</p>
                    <p className={`text-xs font-medium ${(quotation.grossProfitRate ?? 0) < 0.16 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {((quotation.grossProfitRate ?? 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" icon={<Eye size={14} />} onClick={() => setViewQuote(quotation)}>查看</Button>
                    <Button variant="outline" size="sm" icon={<Sparkles size={14} />} onClick={() => setInsightQuote(quotation)}>AI洞察</Button>
                    <Button variant="danger" size="sm" icon={<XCircle size={14} />} onClick={() => handleReject(quotation)}>驳回</Button>
                    <Button size="sm" icon={<CheckCircle size={14} />} onClick={() => handleApprove(quotation)}>通过</Button>
                  </div>
                </div>
              );
            })}
            {approvalQueue.length === 0 && (
              <div className="px-6 py-16 text-center text-slate-400">
                <CheckCircle size={36} className="mx-auto mb-3 opacity-30" />
                <p>当前没有待审批报价</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">审批原则</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="rounded-2xl bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">高风险</p>
              <p className="text-xs text-red-600 mt-1">毛利率低于 16%，或金额较大且需要特殊条款时，建议升级审批。</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-700">常规审批</p>
              <p className="text-xs text-amber-700 mt-1">毛利率处于正常区间时，重点确认方案摘要、商机归属和交付条件。</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4">
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-blue-600" />
                <p className="text-sm font-semibold text-blue-700">与纷享销客联动</p>
              </div>
              <p className="text-xs text-blue-700 mt-1">审批通过后，报价状态回写到商机，销售可继续推进客户沟通。</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal isOpen={!!viewQuote} onClose={() => setViewQuote(null)} title="审批详情" size="lg">
        {viewQuote && (
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-sm text-slate-400">{viewQuote.quoteNumber}</p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{viewQuote.customerName}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{viewQuote.projectName ?? viewQuote.linkedOpportunity}</p>
              </div>
              <Badge variant={(viewQuote.grossProfitRate ?? 0) < 0.16 ? 'danger' : 'info'}>
                {(viewQuote.grossProfitRate ?? 0) < 0.16 ? '重点审查' : '标准审批'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-blue-400">报价金额</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">¥{viewQuote.totalPrice.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-400">成本</p>
                <p className="text-2xl font-bold text-slate-700 mt-1">¥{viewQuote.totalCost.toLocaleString()}</p>
              </div>
              <div className={`rounded-2xl p-4 text-center ${(viewQuote.grossProfitRate ?? 0) < 0.16 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                <p className={`text-xs ${(viewQuote.grossProfitRate ?? 0) < 0.16 ? 'text-red-400' : 'text-emerald-400'}`}>毛利率</p>
                <p className={`text-2xl font-bold mt-1 ${(viewQuote.grossProfitRate ?? 0) < 0.16 ? 'text-red-700' : 'text-emerald-700'}`}>{((viewQuote.grossProfitRate ?? 0) * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">审批建议</p>
              <p className="text-sm text-amber-800 mt-1 leading-relaxed">
                {(viewQuote.grossProfitRate ?? 0) < 0.16
                  ? '建议核查是否属于战略项目、是否包含额外交付义务，以及销售是否申请了特殊折扣。'
                  : '建议按标准路径审批，重点确认商机归属、报价摘要与交付条件是否一致。'}
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-3">
              <div>
                <p className="text-xs text-slate-400">当前审批节点</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  {getCurrentApprovalStep(viewQuote)?.stepName ?? '审批流程已结束'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {getCurrentApprovalStep(viewQuote)
                    ? `当前审批人：${getCurrentApprovalStep(viewQuote)?.approverName} / ${getCurrentApprovalStep(viewQuote)?.approverRole}`
                    : getApprovalHeadline(viewQuote)}
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
                      {step.actedAt && <p className="text-[11px] text-slate-400 mt-1">{step.actedAt.slice(0, 10)} {step.actedAt.slice(11, 16)}</p>}
                      {step.comment && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{step.comment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {viewQuote.solutionSummary && (
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-800">方案摘要</p>
                <p className="text-sm text-blue-800 mt-1">{viewQuote.solutionSummary}</p>
              </div>
            )}

            <QuoteInsightPanel insight={buildQuoteInsight(viewQuote, 'approver')} />

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setViewQuote(null)}>关闭</Button>
              <Button variant="danger" className="flex-1" onClick={() => handleReject(viewQuote)}>驳回</Button>
              <Button className="flex-1" onClick={() => handleApprove(viewQuote)}>审批通过</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!insightQuote} onClose={() => setInsightQuote(null)} title="AI 审批洞察" size="lg">
        {insightQuote && (
          <div className="p-6 space-y-4">
            <div>
              <p className="font-mono text-sm text-slate-400">{insightQuote.quoteNumber}</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{insightQuote.customerName}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{insightQuote.projectName ?? insightQuote.linkedOpportunity}</p>
            </div>
            <QuoteInsightPanel insight={buildQuoteInsight(insightQuote, 'approver')} />
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setInsightQuote(null)}>关闭</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
