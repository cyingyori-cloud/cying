// ============ Product Types ============
export interface ProductCatalog {
  id: number;
  parentId: number | null;
  catalogCode: string;
  catalogName: string;
  level: number;
  sortOrder: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  children?: ProductCatalog[];
}

export interface ProductModel {
  id: number;
  catalogId: number;
  modelCode: string;
  modelName: string;
  description?: string;
  imageUrl?: string;
  classification?: string;
  baseCost?: number;
  basePrice: number;
  ratedPowerKw?: number;
  ratedEnergyKWh?: number;
  voltageRange?: string;
  cycleLife?: string;
  designLifeYears?: number;
  certifications?: string[];
  applicationScenarios?: string[];
  parallelCapability?: string;
  thermalStrategy?: string;
  regionCoverage?: string;
  dataSourceNote?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductBom {
  id: number;
  productModelId: number;
  parentBomId: number | null;
  materialCode: string;
  materialName: string;
  specification?: string;
  unit: string;
  quantity: number;
  unitCost: number;
  bomLevel: number;
  isOptional: boolean;
  sortOrder: number;
  children?: ProductBom[];
}

// ============ Feature Types ============
export interface FeatureGroup {
  id: number;
  groupCode: string;
  groupName: string;
  description?: string;
  sortOrder: number;
  features?: Feature[];
}

export interface Feature {
  id: number;
  featureGroupId: number;
  featureCode: string;
  featureName: string;
  featureType: 'SINGLE_SELECT' | 'MULTI_SELECT' | 'INPUT';
  description?: string;
  sortOrder: number;
  options?: FeatureOption[];
}

export interface FeatureOption {
  id: number;
  featureId: number;
  optionCode: string;
  optionName: string;
  optionValue?: string;
  priceImpact: number;
  cost: number;
  performanceScore: number;
  isDefault: boolean;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ProductFeatureRel {
  id: number;
  productModelId: number;
  featureId: number;
  isRequired: boolean;
  defaultOptionId?: number;
}

// ============ Rule Types ============
export type RuleType = 'DEPENDENCY' | 'EXCLUSION' | 'FORCE' | 'RECOMMEND';

export interface ConfigRule {
  id: number;
  ruleCode: string;
  ruleName: string;
  ruleType: RuleType;
  productModelId?: number;
  description?: string;
  priority: number;
  isActive: boolean;
  items?: ConfigRuleItem[];
}

export interface ConfigRuleItem {
  id: number;
  ruleId: number;
  itemRole: 'CONDITION' | 'ACTION';
  featureId: number;
  featureOptionId?: number;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN';
}

// ============ Configuration Types ============
export interface ConfigurationRequest {
  productModelId: number;
  selectedOptions: Record<number, number>; // featureId -> optionId
}

export interface ConfigurationResult {
  productModelId: number;
  productModelName: string;
  selectedOptions: Record<number, number>;
  totalCost: number;
  totalPrice: number;
  ruleViolations: string[];
  valid: boolean;
}

export interface ReverseConfigRequest {
  productModelId: number;
  minBudget: number;
  maxBudget: number;
  preferenceWeights?: Record<string, number>;
  resultCount?: number;
}

export interface GeneratedSkuPlan {
  skuCode: string;
  moduleCount: number;
  moduleFire: boolean;
  cabinetFire: boolean;
  lineType: '2线' | '3线';
  cabinetCount: number;
  estimatedVoltage: number;
  estimatedCurrent: number;
  estimatedEnergyKWh: number;
  status: 'VALID' | 'WARNING' | 'INVALID';
  warningReasons: string[];
  recommended: boolean;
  pricingTiers: {
    level1: number;
    level2: number;
    level3: number;
  };
}

export interface ConfigScheme {
  schemeName: string;
  schemeTag: 'HIGH_PERFORMANCE' | 'BALANCED' | 'COST_EFFECTIVE' | 'ALTERNATIVE';
  configDetail: Record<number, number>; // featureId -> optionId
  configReadable: Record<string, string>; // optionName -> optionValue
  totalCost: number;
  totalPrice: number;
  performanceScore: number;
  costEfficiencyScore: number;
}

// ============ Quotation Types ============
export type QuoteStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type QuoteType = 'CPQ' | 'NON_PROJECT';
export type ApprovalStepStatus = 'DONE' | 'CURRENT' | 'PENDING' | 'REJECTED';

export interface ApprovalStep {
  id: number;
  stepName: string;
  approverName: string;
  approverRole: string;
  status: ApprovalStepStatus;
  actedAt?: string;
  comment?: string;
}

export interface Quotation {
  id: number;
  quoteNumber: string;
  quoteType: QuoteType;
  customerName?: string;
  customerContact?: string;
  projectName?: string;
  linkedOpportunity?: string;
  sourceSystem?: string;
  opportunityOwner?: string;
  solutionSummary?: string;
  totalCost: number;
  totalPrice: number;
  grossProfitRate?: number;
  currency: string;
  status: QuoteStatus;
  validUntil?: string;
  remarks?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  approvalSteps?: ApprovalStep[];
  cpqLines?: QuotationLineCpq[];
  standardLines?: QuotationLineStandard[];
}

export interface QuotationLineCpq {
  id: number;
  quotationId: number;
  productModelId: number;
  productModelName?: string;
  quantity: number;
  lineCost: number;
  linePrice: number;
  configSnapshot?: Record<string, unknown>;
  sortOrder: number;
}

export interface QuotationLineStandard {
  id: number;
  quotationId: number;
  materialCode: string;
  materialName: string;
  specification?: string;
  unit: string;
  quantity: number;
  unitCost: number;
  grossProfitRate: number;
  unitPrice: number;
  linePrice: number;
  sortOrder: number;
}

export interface StandardLineItemForm {
  materialCode: string;
  materialName: string;
  specification: string;
  unit: string;
  quantity: number;
  unitCost: number;
}

export interface GpConfig {
  id: number;
  configType: 'GLOBAL' | 'CATEGORY' | 'CUSTOMER';
  referenceId?: string;
  grossProfitRate: number;
  isActive: boolean;
}

// ============ Dashboard Types ============
export interface DashboardStats {
  totalQuotations: number;
  totalProducts: number;
  totalRevenue: number;
  pendingApprovals: number;
  revenueGrowth: number;
  quotationGrowth: number;
}

export interface MarketIndicator {
  name: string;
  price: string;
  unit: string;
  change: string;
  isUp: boolean;
  time: string;
  note?: string;
}
