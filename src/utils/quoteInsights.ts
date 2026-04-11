import type { AppRole } from '../data/roleViews';
import type { Quotation } from '../types';

export interface QuoteInsightResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskLabel: string;
  executiveSummary: string;
  approvalOpinion: string;
  keyFindings: string[];
  recommendations: string[];
  negotiationPoints: string[];
  roleFocusTitle: string;
  roleFocusBody: string;
}

function getRiskLevel(quotation: Quotation): QuoteInsightResult['riskLevel'] {
  const grossProfitRate = quotation.grossProfitRate ?? 0;
  const isLargeDeal = quotation.totalPrice >= 1_000_000;
  const isPending = quotation.status === 'SUBMITTED';
  const hasWeakSummary = !quotation.solutionSummary || quotation.solutionSummary.length < 18;

  if (grossProfitRate < 0.16 || (isLargeDeal && isPending) || hasWeakSummary) return 'HIGH';
  if (grossProfitRate < 0.2 || quotation.status === 'DRAFT') return 'MEDIUM';
  return 'LOW';
}

function getRiskLabel(level: QuoteInsightResult['riskLevel']) {
  return level === 'HIGH' ? '高风险' : level === 'MEDIUM' ? '中风险' : '低风险';
}

export function buildQuoteInsight(quotation: Quotation, role: AppRole): QuoteInsightResult {
  const grossProfitRate = quotation.grossProfitRate ?? 0;
  const grossProfit = quotation.totalPrice - quotation.totalCost;
  const riskLevel = getRiskLevel(quotation);
  const riskLabel = getRiskLabel(riskLevel);
  const solutionParts = quotation.solutionSummary?.split('/').map((part) => part.trim()).filter(Boolean) ?? [];
  const isLargeDeal = quotation.totalPrice >= 1_000_000;
  const hasOpportunity = Boolean(quotation.linkedOpportunity);
  const roleFocusMap: Record<AppRole, { title: string; body: string }> = {
    executive: {
      title: '经营视角洞察',
      body: riskLevel === 'HIGH'
        ? '这张报价单对经营影响较大，建议结合项目战略价值、交付风险与审批效率一并判断。'
        : '这张报价单经营结构相对健康，更适合作为重点推进或规模复制样本。',
    },
    sales: {
      title: '销售视角洞察',
      body: `当前最值得对客户输出的卖点是“${solutionParts.slice(0, 2).join(' / ') || '标准配置方案'}”，建议围绕价值点推进沟通。`,
    },
    presales: {
      title: '售前视角洞察',
      body: solutionParts.length >= 3
        ? '该方案特征较完整，适合进一步核查认证口径、并机限制和成本拆解。'
        : '方案摘要仍偏简略，建议补全关键配置、交付区域和安全口径后再对外输出。',
    },
    product: {
      title: '产品视角洞察',
      body: '这张报价单可以沉淀为产品样本，适合回收为型号主数据、规则资产或标准场景模板。',
    },
    approver: {
      title: '审批视角洞察',
      body: riskLevel === 'HIGH'
        ? '建议优先核查毛利率、特殊折扣、交付义务和客户战略属性，再决定是否升级审批。'
        : '建议按标准流程审批，重点确认商机归属、摘要完整度和价格边界是否一致。',
    },
  };

  const keyFindings = [
    `当前报价金额 ${quotation.totalPrice.toLocaleString()} 元，毛利润 ${grossProfit.toLocaleString()} 元，毛利率 ${(grossProfitRate * 100).toFixed(1)}%。`,
    hasOpportunity
      ? `已绑定纷享销客商机 ${quotation.linkedOpportunity}，适合做销售与审批协同。`
      : '尚未绑定正式商机号，建议补全来源系统信息后再外发。',
    solutionParts.length >= 3
      ? `方案摘要已覆盖 ${solutionParts.length} 个关键要点，具备做 AI 复盘和对外摘要的基础。`
      : '方案摘要偏少，建议补充产品型号、应用策略、并机方式或区域交付口径。',
  ];

  if (isLargeDeal) keyFindings.push('该报价金额已达到重点项目量级，建议提高审批与履约关注等级。');
  if (quotation.status === 'DRAFT') keyFindings.push('报价仍处于草稿状态，更适合在 AI 洞察后补强摘要与客户信息。');
  if (quotation.status === 'SUBMITTED') keyFindings.push('报价已进入待审批阶段，AI 建议可直接作为审批辅助说明。');

  const recommendations = [
    grossProfitRate < 0.16
      ? '优先核查是否存在战略折扣、交付附加义务或客户换单风险。'
      : '保持当前价格边界，同时确认客户对方案摘要中的核心配置是否认可。',
    solutionParts.length >= 3
      ? '保留现有方案骨架，继续补充认证、交付区域和服务边界说明。'
      : '补全方案摘要，让客户、审批人和售前对同一份报价有一致理解。',
    hasOpportunity
      ? '将 AI 洞察摘要同步回纷享销客商机，便于销售后续推进。'
      : '补全商机号与客户信息，避免后续追踪断点。',
  ];

  const negotiationPoints = [
    '优先围绕“公开产品能力 + 场景适配”来解释价格，而不是直接压价。',
    grossProfitRate < 0.16
      ? '若客户继续压价，建议先换方案或收缩交付边界，而不是再降毛利。'
      : '若客户压价，可优先调整服务范围、并机规格或认证口径。',
    isLargeDeal
      ? '大项目建议准备一份“方案对比 + 审批说明”作为谈判辅助。'
      : '中小项目更适合输出精简版方案摘要，提升客户理解速度。',
  ];

  const approvalOpinion = riskLevel === 'HIGH'
    ? 'AI 判断该报价风险偏高，建议升级审批或至少补充更完整的报价依据。'
    : riskLevel === 'MEDIUM'
      ? 'AI 判断该报价风险可控，但仍建议在提交前补强摘要和商机绑定信息。'
      : 'AI 判断该报价结构较健康，可作为标准流程推进。';

  return {
    riskLevel,
    riskLabel,
    executiveSummary: `${riskLabel}。该报价${grossProfitRate < 0.16 ? '毛利偏低' : '毛利结构正常'}，${hasOpportunity ? '已绑定商机' : '仍需补全商机信息'}，适合继续用 AI 作为辅助判断工具。`,
    approvalOpinion,
    keyFindings,
    recommendations,
    negotiationPoints,
    roleFocusTitle: roleFocusMap[role].title,
    roleFocusBody: roleFocusMap[role].body,
  };
}
