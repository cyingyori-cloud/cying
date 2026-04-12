import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertCircle, ArrowRight, Boxes, BriefcaseBusiness, CheckCircle, ChevronRight, Clock,
  Cpu, FileText, GitBranch, Package, ShieldAlert, Sparkles, TrendingUp, Zap,
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  marketIndicators, mockBoms, mockFeatures, mockRules, revenueData,
} from '../data/mockData';
import { roleViewMap } from '../data/roleViews';
import { useAppStore } from '../store/appStore';
import type { QuoteStatus, Quotation } from '../types';

const statusConfig: Record<QuoteStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'purple' }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  SUBMITTED: { label: '待审批', variant: 'info' },
  APPROVED: { label: '已审批', variant: 'success' },
  REJECTED: { label: '已驳回', variant: 'danger' },
  EXPIRED: { label: '已过期', variant: 'warning' },
};

function formatCurrency(value: number) {
  if (value >= 10000) return `¥${(value / 10000).toFixed(1)}万`;
  return `¥${value.toLocaleString()}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function MarketTicker() {
  return (
    <>
      <style>{`
        @keyframes ticker {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .animate-ticker {
          display: inline-flex;
          white-space: nowrap;
          animation: ticker 32s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="bg-slate-900 text-white rounded-xl overflow-hidden flex items-center shadow-lg border border-slate-800">
        <div className="bg-brand-600 px-4 py-2.5 font-semibold text-sm flex-shrink-0 z-10 flex items-center gap-2">
          <TrendingUp size={16} /> 成本敏感指标
        </div>
        <div className="overflow-hidden flex-1 relative">
          <div className="animate-ticker flex items-center gap-8 pl-8">
            {[...marketIndicators, ...marketIndicators].map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-center gap-2 text-sm font-medium">
                <span className="text-slate-300">{item.name}</span>
                <span className="text-white">¥{item.price}</span>
                <span className={item.isUp ? 'text-red-400' : 'text-emerald-400'}>{item.change}</span>
                <span className="text-slate-500 text-xs ml-2 border-r border-slate-700 pr-8">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function RoleIntro({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <Card className="border border-slate-200 bg-slate-50/80">
      <CardBody className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{body}</p>
        </div>
        {actionLabel && onAction && (
          <Button size="sm" icon={<ArrowRight size={14} />} onClick={onAction}>{actionLabel}</Button>
        )}
      </CardBody>
    </Card>
  );
}

function TrendChart({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">2026 年演示口径</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-brand-500" />报价额</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />成本</div>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8602C" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#E8602C" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`} />
            <Tooltip formatter={(value) => [`¥${Number(value).toLocaleString()}`, '']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
            <Area type="monotone" dataKey="revenue" stroke="#E8602C" strokeWidth={2} fill="url(#revenue)" name="报价额" />
            <Area type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} fill="url(#cost)" name="成本" />
          </AreaChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}

function RecentQuoteList({
  title,
  rows,
  footerAction,
}: {
  title: string;
  rows: Quotation[];
  footerAction?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {footerAction}
        </div>
      </CardHeader>
      <div className="divide-y divide-slate-50">
        {rows.map((quotation) => {
          const status = statusConfig[quotation.status];
          return (
            <div key={quotation.id} className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
              <div className={`p-2 rounded-lg ${quotation.status === 'APPROVED' ? 'bg-emerald-50' : quotation.status === 'REJECTED' ? 'bg-red-50' : 'bg-brand-50'}`}>
                <FileText size={16} className={quotation.status === 'APPROVED' ? 'text-emerald-500' : quotation.status === 'REJECTED' ? 'text-red-500' : 'text-brand-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{quotation.customerName}</p>
                <p className="text-xs text-slate-400 truncate">{quotation.linkedOpportunity ?? quotation.quoteNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(quotation.totalPrice)}</p>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ExecutiveDashboard({
  totalRevenue,
  pendingAmount,
  avgGrossProfit,
  activeProducts,
  aidcProducts,
  pendingQuotations,
  lowMarginQuotes,
  topRevenueQuotes,
  setActiveTab,
}: {
  totalRevenue: number;
  pendingAmount: number;
  avgGrossProfit: number;
  activeProducts: number;
  aidcProducts: number;
  pendingQuotations: Quotation[];
  lowMarginQuotes: Quotation[];
  topRevenueQuotes: Quotation[];
  setActiveTab: (tab: string) => void;
}) {
  return (
    <>
      <RoleIntro
        title="老板/管理层工作台"
        body="聚焦经营结果、重点项目推进、待审批金额和毛利风险，适合高层快速判断这套 CPQ 是否真正提升业务效率。"
        actionLabel="查看审批队列"
        onAction={() => setActiveTab('quotations-list')}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="本期报价总额" value={formatCurrency(totalRevenue)} subtitle="经营盘子" trend={18.9} trendLabel="较上月" icon={<TrendingUp size={20} className="text-brand-600" />} iconBg="bg-brand-50" />
        <StatCard title="待审批金额" value={formatCurrency(pendingAmount)} subtitle={`${pendingQuotations.length} 单待处理`} trend={6.2} trendLabel="较昨日" icon={<Clock size={20} className="text-amber-600" />} iconBg="bg-amber-50" />
        <StatCard title="平均毛利率" value={formatPercent(avgGrossProfit)} subtitle={`${lowMarginQuotes.length} 单低于 16%`} trend={2.4} trendLabel="较上周" icon={<ShieldAlert size={20} className="text-emerald-600" />} iconBg="bg-emerald-50" />
        <StatCard title="产品线覆盖" value={activeProducts} subtitle={`其中 ${aidcProducts} 个 AIDC 型号`} trend={14.3} trendLabel="较上月" icon={<Boxes size={20} className="text-purple-600" />} iconBg="bg-purple-50" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4">
        <TrendChart title="经营报价趋势" />
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">风险与推进</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="rounded-2xl bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">低毛利重点关注</p>
              <p className="text-xs text-red-700 mt-1">{lowMarginQuotes.length} 单报价低于 16%，建议高层复核项目价值与战略意义。</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-700">待审批金额</p>
              <p className="text-xs text-amber-700 mt-1">{formatCurrency(pendingAmount)} 仍在等待处理，直接影响项目推进效率。</p>
            </div>
            <div className="rounded-2xl bg-brand-50 p-4">
              <p className="text-sm font-semibold text-brand-700">产品线覆盖</p>
              <p className="text-xs text-brand-700 mt-1">当前已经覆盖工商业储能、AIDC 储能和家庭储能三条产品线。</p>
            </div>
          </CardBody>
        </Card>
      </div>
      <RecentQuoteList
        title="重点项目推进"
        rows={topRevenueQuotes}
        footerAction={<button onClick={() => setActiveTab('quotations-list')} className="text-xs text-brand-600 font-medium">查看全部</button>}
      />
    </>
  );
}

function SalesDashboard({
  followUpQuotes,
  approvedQuotes,
  syncedQuotes,
  draftCount,
  pendingCount,
  activeProducts,
  setActiveTab,
}: {
  followUpQuotes: Quotation[];
  approvedQuotes: Quotation[];
  syncedQuotes: number;
  draftCount: number;
  pendingCount: number;
  activeProducts: number;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <>
      <RoleIntro
        title="销售工作台"
        body="优先看待跟进商机、可回传客户的方案摘要和下一步动作，帮助销售快速推进成交。"
        actionLabel="新建报价"
        onAction={() => setActiveTab('quotations-cpq')}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-brand-100">
          <CardBody className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">我的商机任务</p>
                <p className="text-xs text-slate-400 mt-1">{followUpQuotes.length} 条待跟进</p>
              </div>
              <BriefcaseBusiness size={18} className="text-brand-500" />
            </div>
            <Button className="mt-4 w-full" size="sm" icon={<Sparkles size={14} />} onClick={() => setActiveTab('configurator-reverse')}>去 AI 选配</Button>
          </CardBody>
        </Card>
        <Card className="border border-emerald-100">
          <CardBody className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">可回传客户方案</p>
                <p className="text-xs text-slate-400 mt-1">{approvedQuotes.length} 条已审批</p>
              </div>
              <CheckCircle size={18} className="text-emerald-500" />
            </div>
            <Button variant="outline" className="mt-4 w-full" size="sm" onClick={() => setActiveTab('quotations-list')}>查看报价单</Button>
          </CardBody>
        </Card>
        <Card className="border border-purple-100">
          <CardBody className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">可讲解产品覆盖</p>
                <p className="text-xs text-slate-400 mt-1">{activeProducts} 个在售型号</p>
              </div>
              <Package size={18} className="text-purple-500" />
            </div>
            <p className="mt-4 text-xs text-slate-500">已同步商机报价 {syncedQuotes} 条，销售可以直接复用历史摘要对客户输出。</p>
          </CardBody>
        </Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">销售推进漏斗</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '待补全', value: draftCount, variant: 'default' as const },
                { label: '待审批', value: pendingCount, variant: 'info' as const },
                { label: '可回传', value: approvedQuotes.length, variant: 'success' as const },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 p-5 text-center">
                  <Badge variant={item.variant}>{item.label}</Badge>
                  <p className="mt-3 text-3xl font-bold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">销售动作建议</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {followUpQuotes.slice(0, 3).map((quotation) => (
              <div key={quotation.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{quotation.customerName}</p>
                <p className="text-xs text-slate-400 mt-1">{quotation.linkedOpportunity ?? quotation.projectName}</p>
                <p className="text-xs text-slate-600 mt-2">{quotation.status === 'DRAFT' ? '建议补全商机与客户信息后提交审批。' : '建议催审或向客户预热方案。'}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
      <RecentQuoteList title="待跟进商机报价" rows={followUpQuotes.slice(0, 5)} />
    </>
  );
}

function PresalesDashboard({
  quotations,
  activeProducts,
  bomCoveredModels,
  activeRules,
  setActiveTab,
}: {
  quotations: Quotation[];
  activeProducts: number;
  bomCoveredModels: number;
  activeRules: number;
  setActiveTab: (tab: string) => void;
}) {
  const complexQuotes = [...quotations].sort((a, b) => (b.solutionSummary?.length ?? 0) - (a.solutionSummary?.length ?? 0)).slice(0, 5);
  return (
    <>
      <RoleIntro
        title="售前/方案经理工作台"
        body="这里更偏方案设计视角，突出产品配置能力、规则约束、BOM 成本拆解和多方案比较。"
        actionLabel="进入正向选配"
        onAction={() => setActiveTab('configurator-forward')}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="可配置型号" value={activeProducts} subtitle={`${bomCoveredModels} 个型号含 BOM`} trend={14.3} trendLabel="较上月" icon={<Package size={20} className="text-brand-600" />} iconBg="bg-brand-50" />
        <StatCard title="特征配置项" value={mockFeatures.length} subtitle="关键交付参数" trend={6.8} trendLabel="较上周" icon={<Cpu size={20} className="text-emerald-600" />} iconBg="bg-emerald-50" />
        <StatCard title="有效规则数" value={activeRules} subtitle="依赖 / 互斥 / 推荐" trend={10.5} trendLabel="较上周" icon={<ShieldAlert size={20} className="text-purple-600" />} iconBg="bg-purple-50" />
        <StatCard title="复杂方案样本" value={complexQuotes.length} subtitle="适合沉淀复用" trend={7.7} trendLabel="较上月" icon={<GitBranch size={20} className="text-amber-600" />} iconBg="bg-amber-50" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">方案设计入口</h3>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-3">
            {[
              { label: '正向选配', desc: '人工选型 + 实时规则校验', action: () => setActiveTab('configurator-forward') },
              { label: 'AI反向选配', desc: '按预算生成三套方案', action: () => setActiveTab('configurator-reverse') },
              { label: '规则中心', desc: '查看依赖/互斥关系', action: () => setActiveTab('rules') },
              { label: 'BOM成本', desc: '核对物料拆解与估算', action: () => setActiveTab('products-bom') },
            ].map((item) => (
              <button key={item.label} onClick={item.action} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-blue-300 hover:bg-brand-50 transition-colors">
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
              </button>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">技术校验重点</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="rounded-2xl bg-brand-50 p-4">
              <p className="text-sm font-semibold text-brand-700">认证口径</p>
              <p className="text-xs text-brand-700 mt-1">北美 UL9540A、欧盟 IEC/CE、日本 JET 与家储出口口径需要优先确认。</p>
            </div>
            <div className="rounded-2xl bg-purple-50 p-4">
              <p className="text-sm font-semibold text-purple-700">规则命中</p>
              <p className="text-xs text-purple-700 mt-1">售前需要重点关注并机、消防、安全包与区域交付规则。</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-700">成本拆解</p>
              <p className="text-xs text-amber-700 mt-1">BOM 叶子物料成本已纳入报价估算，可用于方案阶段快速核价。</p>
            </div>
          </CardBody>
        </Card>
      </div>
      <RecentQuoteList title="最近方案支撑报价" rows={complexQuotes} />
    </>
  );
}

function ProductDashboard({
  quotations,
  products,
  activeRules,
  bomCoveredModels,
  setActiveTab,
}: {
  quotations: Quotation[];
  products: ReturnType<typeof useAppStore.getState>['products'];
  activeRules: number;
  bomCoveredModels: number;
  setActiveTab: (tab: string) => void;
}) {
  const productFeedbackSamples = [...quotations].sort((a, b) => (a.customerName ?? '').localeCompare(b.customerName ?? '')).slice(0, 5);
  return (
    <>
      <RoleIntro
        title="产品/解决方案负责人工作台"
        body="这里关注型号主数据、规则资产、BOM 覆盖度和不同产品线的治理成熟度。"
        actionLabel="进入产品型号"
        onAction={() => setActiveTab('products-models')}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="型号主数据" value={products.length} subtitle="当前已录入型号" trend={14.3} trendLabel="较上月" icon={<Package size={20} className="text-brand-600" />} iconBg="bg-brand-50" />
        <StatCard title="特征配置项" value={mockFeatures.length} subtitle="覆盖关键参数" trend={6.8} trendLabel="较上周" icon={<Cpu size={20} className="text-emerald-600" />} iconBg="bg-emerald-50" />
        <StatCard title="规则资产" value={activeRules} subtitle="已启用业务规则" trend={10.5} trendLabel="较上周" icon={<GitBranch size={20} className="text-purple-600" />} iconBg="bg-purple-50" />
        <StatCard title="BOM覆盖型号" value={bomCoveredModels} subtitle="可做成本拆解" trend={5.4} trendLabel="较上月" icon={<Boxes size={20} className="text-amber-600" />} iconBg="bg-amber-50" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">产品线覆盖矩阵</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {[
              { label: '工商业储能', count: products.filter((product) => product.catalogId === 4 || product.catalogId === 5).length, color: 'bg-brand-500' },
              { label: '数据中心储能', count: products.filter((product) => product.catalogId === 6 || product.catalogId === 7).length, color: 'bg-emerald-500' },
              { label: '家庭储能', count: products.filter((product) => product.catalogId === 8).length, color: 'bg-amber-500' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{item.label}</span>
                  <span className="font-semibold text-slate-900">{item.count} 个型号</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white overflow-hidden">
                  <div className={`h-full ${item.color}`} style={{ width: `${(item.count / Math.max(products.length, 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">主数据维护入口</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {[
              { label: '产品目录', desc: '维护产品线层级与分类', action: () => setActiveTab('products-catalog') },
              { label: '产品型号', desc: '维护参数、估算成本和场景', action: () => setActiveTab('products-models') },
              { label: '特征配置', desc: '维护可配置特征与默认选项', action: () => setActiveTab('features') },
              { label: '规则中心', desc: '维护依赖、互斥和推荐规则', action: () => setActiveTab('rules') },
            ].map((item) => (
              <button key={item.label} onClick={item.action} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-blue-300 hover:bg-brand-50 transition-colors">
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>
      <RecentQuoteList title="可沉淀为产品样本的报价" rows={productFeedbackSamples} />
    </>
  );
}

function ApproverDashboard({
  pendingQuotations,
  pendingAmount,
  lowMarginQuotes,
  rejectedCount,
  setActiveTab,
}: {
  pendingQuotations: Quotation[];
  pendingAmount: number;
  lowMarginQuotes: Quotation[];
  rejectedCount: number;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <>
      <RoleIntro
        title="审批人/经营管理工作台"
        body="审批角色优先看待审批队列、低毛利风险和需要升级审批的项目，系统已按风险级别做初步排序。"
        actionLabel="进入审批工作台"
        onAction={() => setActiveTab('approval-workbench')}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="待审批报价" value={pendingQuotations.length} subtitle="当前审批负载" trend={6.2} trendLabel="较昨日" icon={<Clock size={20} className="text-brand-600" />} iconBg="bg-brand-50" />
        <StatCard title="待审批金额" value={formatCurrency(pendingAmount)} subtitle="金额敞口" trend={4.9} trendLabel="较昨日" icon={<TrendingUp size={20} className="text-emerald-600" />} iconBg="bg-emerald-50" />
        <StatCard title="低毛利报价" value={lowMarginQuotes.length} subtitle="低于 16%" trend={-2.0} trendLabel="较上周" icon={<ShieldAlert size={20} className="text-red-600" />} iconBg="bg-red-50" />
        <StatCard title="已驳回报价" value={rejectedCount} subtitle="待回流修正" trend={3.1} trendLabel="较上月" icon={<AlertCircle size={20} className="text-amber-600" />} iconBg="bg-amber-50" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
        <RecentQuoteList
          title="待审批 / 风险报价"
          rows={[...pendingQuotations, ...lowMarginQuotes].slice(0, 5)}
          footerAction={<button onClick={() => setActiveTab('approval-workbench')} className="text-xs text-brand-600 font-medium">打开工作台</button>}
        />
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">审批原则</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="rounded-2xl bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">升级审批</p>
              <p className="text-xs text-red-700 mt-1">毛利率低于 16%，或金额较大且条款复杂时，建议重点审查。</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-700">标准审批</p>
              <p className="text-xs text-amber-700 mt-1">毛利率正常时，重点确认商机归属、方案摘要与交付条件。</p>
            </div>
            <div className="rounded-2xl bg-brand-50 p-4">
              <p className="text-sm font-semibold text-brand-700">回写 CRM</p>
              <p className="text-xs text-brand-700 mt-1">审批通过后，报价状态回写到纷享销客，销售可以继续推进客户沟通。</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export function Dashboard() {
  const { setActiveTab, quotations, products, currentRole } = useAppStore();
  const roleInfo = roleViewMap[currentRole];
  const totalRevenue = quotations.reduce((sum, quotation) => sum + quotation.totalPrice, 0);
  const pendingQuotations = quotations.filter((quotation) => quotation.status === 'SUBMITTED');
  const pendingAmount = pendingQuotations.reduce((sum, quotation) => sum + quotation.totalPrice, 0);
  const approvedQuotes = quotations.filter((quotation) => quotation.status === 'APPROVED');
  const draftCount = quotations.filter((quotation) => quotation.status === 'DRAFT').length;
  const rejectedCount = quotations.filter((quotation) => quotation.status === 'REJECTED').length;
  const syncedQuotes = quotations.filter((quotation) => quotation.sourceSystem === '纷享销客CRM').length;
  const avgGrossProfit = quotations.length > 0
    ? quotations.reduce((sum, quotation) => sum + (quotation.grossProfitRate ?? 0), 0) / quotations.length
    : 0;
  const activeProducts = products.filter((product) => product.status === 'ACTIVE').length;
  const aidcProducts = products.filter((product) => (product.classification ?? '').includes('AIDC')).length;
  const activeRules = mockRules.filter((rule) => rule.isActive).length;
  const bomCoveredModels = new Set(mockBoms.map((bom) => bom.productModelId)).size;
  const lowMarginQuotes = quotations.filter((quotation) => (quotation.grossProfitRate ?? 0) < 0.16);
  const followUpQuotes = quotations.filter((quotation) => quotation.status === 'DRAFT' || quotation.status === 'SUBMITTED');
  const topRevenueQuotes = [...quotations].sort((a, b) => b.totalPrice - a.totalPrice).slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <MarketTicker />

      {currentRole === 'executive' && (
        <ExecutiveDashboard
          totalRevenue={totalRevenue}
          pendingAmount={pendingAmount}
          avgGrossProfit={avgGrossProfit}
          activeProducts={activeProducts}
          aidcProducts={aidcProducts}
          pendingQuotations={pendingQuotations}
          lowMarginQuotes={lowMarginQuotes}
          topRevenueQuotes={topRevenueQuotes}
          setActiveTab={setActiveTab}
        />
      )}

      {currentRole === 'sales' && (
        <SalesDashboard
          followUpQuotes={followUpQuotes}
          approvedQuotes={approvedQuotes}
          syncedQuotes={syncedQuotes}
          draftCount={draftCount}
          pendingCount={pendingQuotations.length}
          activeProducts={activeProducts}
          setActiveTab={setActiveTab}
        />
      )}

      {currentRole === 'presales' && (
        <PresalesDashboard
          quotations={quotations}
          activeProducts={activeProducts}
          bomCoveredModels={bomCoveredModels}
          activeRules={activeRules}
          setActiveTab={setActiveTab}
        />
      )}

      {currentRole === 'product' && (
        <ProductDashboard
          quotations={quotations}
          products={products}
          activeRules={activeRules}
          bomCoveredModels={bomCoveredModels}
          setActiveTab={setActiveTab}
        />
      )}

      {currentRole === 'approver' && (
        <ApproverDashboard
          pendingQuotations={pendingQuotations}
          pendingAmount={pendingAmount}
          lowMarginQuotes={lowMarginQuotes}
          rejectedCount={rejectedCount}
          setActiveTab={setActiveTab}
        />
      )}

      <Card className="border border-slate-200 bg-slate-50/80">
        <CardBody className="px-5 py-4">
          <p className="text-xs text-slate-500">
            当前角色：{roleInfo.label}。这套演示的重点是让不同岗位打开系统时，看到的重点模块、默认入口和可操作行为都不一样。
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
