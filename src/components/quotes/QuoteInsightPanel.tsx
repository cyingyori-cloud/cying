import { Lightbulb, MessageSquareQuote, ShieldAlert, Sparkles } from 'lucide-react';
import { Badge } from '../ui/Badge';
import type { QuoteInsightResult } from '../../utils/quoteInsights';

interface QuoteInsightPanelProps {
  insight: QuoteInsightResult;
}

export function QuoteInsightPanel({ insight }: QuoteInsightPanelProps) {
  const riskVariant = insight.riskLevel === 'HIGH' ? 'danger' : insight.riskLevel === 'MEDIUM' ? 'warning' : 'success';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-blue-600" />
          <p className="text-sm font-semibold text-slate-900">AI 洞察摘要</p>
          <Badge variant={riskVariant}>{insight.riskLabel}</Badge>
        </div>
        <p className="text-sm text-slate-700 mt-2 leading-relaxed">{insight.executiveSummary}</p>
        <p className="text-xs text-slate-500 mt-2">{insight.roleFocusTitle}：{insight.roleFocusBody}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-amber-600" />
            <p className="text-sm font-semibold text-slate-900">关键发现</p>
          </div>
          <div className="mt-3 space-y-2">
            {insight.keyFindings.map((finding) => (
              <p key={finding} className="text-xs text-slate-600 leading-relaxed">{finding}</p>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} className="text-blue-600" />
            <p className="text-sm font-semibold text-slate-900">AI 建议</p>
          </div>
          <div className="mt-3 space-y-2">
            {insight.recommendations.map((recommendation) => (
              <p key={recommendation} className="text-xs text-slate-600 leading-relaxed">{recommendation}</p>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <MessageSquareQuote size={14} className="text-purple-600" />
            <p className="text-sm font-semibold text-slate-900">谈判/审批建议</p>
          </div>
          <div className="mt-3 space-y-2">
            {insight.negotiationPoints.map((point) => (
              <p key={point} className="text-xs text-slate-600 leading-relaxed">{point}</p>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-white px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-500">审批结论</p>
            <p className="text-xs text-slate-700 mt-1 leading-relaxed">{insight.approvalOpinion}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
