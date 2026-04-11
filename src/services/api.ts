/**
 * PowerQuote API Service
 * API 服务层 - 支持切换 Mock 和真实 API
 */

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// 是否使用 Mock 数据（开发环境可设为 true）
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || false;

// 通用请求函数
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Request Failed: ${endpoint}`, error);
    throw error;
  }
}

// ============ 产品目录 API ============

export interface Product {
  id: string;
  modelCode: string;
  modelName: string;
  classification: string;
  ratedPowerKw: number;
  ratedEnergyKWh: number;
  basePrice: number;
  baseCost: number;
  parallelCapability: string;
  warrantyYears: number;
  certifications: string[];
  status: 'active' | 'inactive';
}

export const productApi = {
  // 获取产品列表
  list: () => request<Product[]>('/products'),
  
  // 获取产品详情
  getById: (id: string) => request<Product>(`/products/${id}`),
};

// ============ 需求匹配 API ============

export interface DemandMatchingParams {
  projectName: string;
  scenario: string;
  targetPowerKw: number;
  targetEnergyKWh: number;
  backupMinutes: number;
  dcVoltageMin: number;
  dcVoltageMax: number;
  topology: string;
  specialRequirements: string;
  moduleCounts: number[];
  moduleFireFilter: 'ALL' | 'YES' | 'NO';
  cabinetFireFilter: 'ALL' | 'YES' | 'NO';
  lineTypeFilter: 'ALL' | '2线' | '3线';
}

export interface DemandRecord {
  id: number;
  projectName: string;
  scenario: string;
  targetPowerKw: number;
  targetEnergyKWh: number;
  backupMinutes: number;
  dcVoltageMin: number;
  dcVoltageMax: number;
  topology: string;
  specialRequirements: string;
  moduleCounts: number[];
  moduleFireFilter: string;
  cabinetFireFilter: string;
  lineTypeFilter: string;
  recommendedProductId: string;
  createdAt: string;
  updatedAt: string;
}

export const demandMatchingApi = {
  // 获取需求记录列表
  list: () => request<DemandRecord[]>('/demand-matching'),
  
  // 获取需求记录详情
  getById: (id: number) => request<DemandRecord>(`/demand-matching/${id}`),
  
  // 创建需求记录
  create: (data: DemandMatchingParams) => 
    request<{ success: boolean; data: DemandRecord }>('/demand-matching', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  // 方案计算（核心接口）
  calculate: (params: DemandMatchingParams) =>
    request<{
      success: boolean;
      data: CandidatePlan[];
      message: string;
    }>('/demand-matching/calculate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

// ============ 候选方案 API ============

export interface CandidatePlan {
  id: string;
  skuCode: string;
  moduleCount: number;
  moduleFire: boolean;
  cabinetFire: boolean;
  lineType: string;
  cabinetCount: number;
  estimatedVoltage: number;
  estimatedMinVoltage: number;
  estimatedCurrent: number;
  estimatedEnergyKWh: number;
  estimatedBackupMin: number;
  status: 'VALID' | 'WARNING' | 'INVALID';
  analysisStatusLabel: string;
  analysisStatusDetail: string;
  analysisSummary: string;
  warnings: string[];
  rankScore: number;
  estimatedCost: number;
  recommended: boolean;
  pricingTiers: {
    level1: number;
    level2: number;
    level3: number;
  };
  createdAt: string;
}

export const candidatePlanApi = {
  // 获取需求对应的候选方案
  list: (demandId: number) => request<CandidatePlan[]>(`/candidate-plans/${demandId}`),
};

// ============ 报价单 API ============

export interface Quotation {
  id: number;
  quotationNo: string;
  customerName: string;
  projectName: string;
  totalAmount: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  plans: CandidatePlan[];
  createdAt: string;
  updatedAt: string;
}

export const quotationApi = {
  // 获取报价单列表
  list: () => request<Quotation[]>('/quotations'),
  
  // 获取报价单详情
  getById: (id: number) => request<Quotation>(`/quotations/${id}`),
  
  // 创建报价单
  create: (data: Partial<Quotation>) =>
    request<{ success: boolean; data: Quotation }>('/quotations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  // 更新报价单
  update: (id: number, data: Partial<Quotation>) =>
    request<{ success: boolean; data: Quotation }>(`/quotations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  // 删除报价单
  delete: (id: number) =>
    request<{ success: boolean }>(`/quotations/${id}`, {
      method: 'DELETE',
    }),
};

// 导出所有 API
export default {
  products: productApi,
  demandMatching: demandMatchingApi,
  candidatePlans: candidatePlanApi,
  quotations: quotationApi,
};
