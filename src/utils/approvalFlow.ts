import type { ApprovalStep, Quotation } from '../types';

function buildApprovalSteps(quotation: Quotation): ApprovalStep[] {
  const timestamp = new Date().toISOString();
  const grossProfitRate = quotation.grossProfitRate ?? 0;
  const amount = quotation.totalPrice;
  const isLargeDeal = amount >= 1_000_000;
  const isLowMargin = grossProfitRate < 0.16;
  const isVeryLowMargin = grossProfitRate < 0.12;
  const requiresPresales = Boolean(quotation.solutionSummary);
  const needsBusinessReview = isLargeDeal || isLowMargin;
  const needsExecutiveReview = isVeryLowMargin || amount >= 2_500_000 || /战略|特殊|高海拔|例外/.test(quotation.remarks ?? '');

  const steps: ApprovalStep[] = [
    {
      id: 1,
      stepName: '销售经理提交',
      approverName: quotation.createdBy ?? quotation.opportunityOwner ?? '销售经理',
      approverRole: '销售经理',
      status: 'DONE',
      actedAt: timestamp,
      comment: '已从报价草稿提交审批。',
    },
  ];

  if (requiresPresales) {
    steps.push({
      id: 2,
      stepName: '售前方案复核',
      approverName: '陈楠',
      approverRole: '售前经理',
      status: 'PENDING',
      comment: isLowMargin ? '需同时复核方案边界与低毛利原因。' : '待确认方案摘要、技术边界与风险说明。',
    });
  }

  if (needsBusinessReview) {
    steps.push({
      id: 3,
      stepName: '经营管理审批',
      approverName: '王珺',
      approverRole: '经营管理负责人',
      status: 'PENDING',
      comment: isLowMargin ? '低毛利报价，需确认价格策略和项目价值。' : '大金额报价，需确认授权边界。',
    });
  }

  if (needsExecutiveReview) {
    steps.push({
      id: 4,
      stepName: '高层特批',
      approverName: '总经理',
      approverRole: '经营管理层',
      status: 'PENDING',
      comment: '满足战略/超大金额/例外条件，需要高层决策。',
    });
  }

  steps.push({
    id: steps.length + 1,
    stepName: 'CRM回传',
    approverName: '系统回传',
    approverRole: 'CRM集成',
    status: 'PENDING',
    comment: '审批完成后自动回写商机与报价状态。',
  });

  const firstPending = steps.find((step) => step.status === 'PENDING');
  if (firstPending) {
    firstPending.status = 'CURRENT';
  }
  return steps;
}

export function getCurrentApprovalStep(quotation: Quotation): ApprovalStep | undefined {
  return quotation.approvalSteps?.find((step) => step.status === 'CURRENT')
    ?? quotation.approvalSteps?.find((step) => step.status === 'PENDING');
}

export function getApprovalHeadline(quotation: Quotation) {
  const currentStep = getCurrentApprovalStep(quotation);
  if (!currentStep) {
    return quotation.status === 'APPROVED'
      ? '审批流程已结束，已完成最终回传。'
      : quotation.status === 'REJECTED'
        ? '审批流程已驳回，等待销售或售前修正后再次提交。'
        : '当前尚未进入审批流。';
  }
  return `当前卡在「${currentStep.stepName}」，审批人：${currentStep.approverName}。`;
}

export function submitQuotationFlow(quotation: Quotation): Quotation {
  const timestamp = new Date().toISOString();
  const nextSteps = buildApprovalSteps(quotation);
  return {
    ...quotation,
    status: 'SUBMITTED',
    updatedAt: timestamp,
    approvalSteps: nextSteps,
  };
}

export function approveQuotationFlow(quotation: Quotation): Quotation {
  const nextSteps = (quotation.approvalSteps ?? []).map((step) => ({ ...step }));
  const currentIndex = nextSteps.findIndex((step) => step.status === 'CURRENT');
  const timestamp = new Date().toISOString();

  if (currentIndex >= 0) {
    nextSteps[currentIndex].status = 'DONE';
    nextSteps[currentIndex].actedAt = timestamp;
    if (!nextSteps[currentIndex].comment) {
      nextSteps[currentIndex].comment = '审批通过';
    }

    const nextPending = nextSteps.find((step, index) => index > currentIndex && step.status === 'PENDING');
    if (nextPending) {
      nextPending.status = 'CURRENT';
      return {
        ...quotation,
        status: 'SUBMITTED',
        updatedAt: timestamp,
        approvalSteps: nextSteps,
      };
    }
  }

  return {
    ...quotation,
    status: 'APPROVED',
    updatedAt: timestamp,
    approvalSteps: nextSteps,
  };
}

export function rejectQuotationFlow(quotation: Quotation): Quotation {
  const nextSteps = (quotation.approvalSteps ?? []).map((step) => ({ ...step }));
  const currentStep = nextSteps.find((step) => step.status === 'CURRENT');
  const timestamp = new Date().toISOString();

  if (currentStep) {
    currentStep.status = 'REJECTED';
    currentStep.actedAt = timestamp;
    if (!currentStep.comment) {
      currentStep.comment = '审批驳回，需补充报价依据';
    }
  }

  nextSteps.forEach((step) => {
    if (step.status === 'PENDING') step.status = 'PENDING';
  });

  return {
    ...quotation,
    status: 'REJECTED',
    updatedAt: timestamp,
    approvalSteps: nextSteps,
  };
}
