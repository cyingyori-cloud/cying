import { create } from 'zustand';
import type {
  ProductModel, Quotation, ConfigScheme, FeatureOption, GeneratedSkuPlan,
} from '../types';
import { mockModels, mockQuotations } from '../data/mockData';
import type { AppRole } from '../data/roleViews';

interface AppState {
  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentRole: AppRole;
  setCurrentRole: (role: AppRole) => void;

  // Products
  products: ProductModel[];
  setProducts: (products: ProductModel[]) => void;
  addProduct: (product: ProductModel) => void;
  updateProduct: (product: ProductModel) => void;
  deleteProduct: (id: number) => void;

  // Configurator
  selectedProduct: ProductModel | null;
  setSelectedProduct: (product: ProductModel | null) => void;
  selectedSkuPlan: GeneratedSkuPlan | null;
  setSelectedSkuPlan: (plan: GeneratedSkuPlan | null) => void;
  selectedOptions: Record<number, number>;
  setSelectedOption: (featureId: number, optionId: number) => void;
  clearSelectedOptions: () => void;
  configuredPrice: number;
  configuredCost: number;
  setConfiguredPrice: (price: number) => void;
  setConfiguredCost: (cost: number) => void;
  ruleViolations: string[];
  setRuleViolations: (violations: string[]) => void;

  // Reverse Config
  reverseSchemes: ConfigScheme[];
  setReverseSchemes: (schemes: ConfigScheme[]) => void;
  isReverseLoading: boolean;
  setIsReverseLoading: (loading: boolean) => void;

  // Quotations
  quotations: Quotation[];
  setQuotations: (quotations: Quotation[]) => void;
  addQuotation: (quotation: Quotation) => void;
  updateQuotation: (quotation: Quotation) => void;

  // Standard Quote Builder
  standardLineItems: Array<{
    id: number;
    materialCode: string;
    materialName: string;
    specification: string;
    unit: string;
    quantity: number;
    unitCost: number;
    grossProfitRate: number;
    unitPrice: number;
    linePrice: number;
  }>;
  addStandardLineItem: () => void;
  updateStandardLineItem: (id: number, field: string, value: unknown) => void;
  removeStandardLineItem: (id: number) => void;
  clearStandardLineItems: () => void;

  // Feature Options map for configurator
  featureOptionsMap: Record<number, FeatureOption[]>;
  setFeatureOptionsMap: (map: Record<number, FeatureOption[]>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  currentRole: 'executive',
  setCurrentRole: (role) => set({ currentRole: role }),

  products: mockModels,
  setProducts: (products) => set({ products }),
  addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
  updateProduct: (product) => set((state) => ({
    products: state.products.map((p) => (p.id === product.id ? product : p)),
  })),
  deleteProduct: (id) => set((state) => ({
    products: state.products.filter((p) => p.id !== id),
  })),

  selectedProduct: null,
  setSelectedProduct: (product) => set({ selectedProduct: product, selectedSkuPlan: null, selectedOptions: {}, ruleViolations: [] }),
  selectedSkuPlan: null,
  setSelectedSkuPlan: (plan) => set({ selectedSkuPlan: plan }),
  selectedOptions: {},
  setSelectedOption: (featureId, optionId) => set((state) => ({
    selectedOptions: { ...state.selectedOptions, [featureId]: optionId },
  })),
  clearSelectedOptions: () => set({ selectedOptions: {}, ruleViolations: [] }),
  configuredPrice: 0,
  configuredCost: 0,
  setConfiguredPrice: (price) => set({ configuredPrice: price }),
  setConfiguredCost: (cost) => set({ configuredCost: cost }),
  ruleViolations: [],
  setRuleViolations: (violations) => set({ ruleViolations: violations }),

  reverseSchemes: [],
  setReverseSchemes: (schemes) => set({ reverseSchemes: schemes }),
  isReverseLoading: false,
  setIsReverseLoading: (loading) => set({ isReverseLoading: loading }),

  quotations: mockQuotations,
  setQuotations: (quotations) => set({ quotations }),
  addQuotation: (quotation) => set((state) => ({
    quotations: [quotation, ...state.quotations],
  })),
  updateQuotation: (quotation) => set((state) => ({
    quotations: state.quotations.map((q) => (q.id === quotation.id ? quotation : q)),
  })),

  standardLineItems: [],
  addStandardLineItem: () => set((state) => ({
    standardLineItems: [
      ...state.standardLineItems,
      {
        id: Date.now(),
        materialCode: '',
        materialName: '',
        specification: '',
        unit: 'PCS',
        quantity: 1,
        unitCost: 0,
        grossProfitRate: 0.15,
        unitPrice: 0,
        linePrice: 0,
      },
    ],
  })),
  updateStandardLineItem: (id, field, value) => set((state) => ({
    standardLineItems: state.standardLineItems.map((item) => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.unitPrice = updated.unitCost * (1 + updated.grossProfitRate);
      updated.linePrice = updated.unitPrice * updated.quantity;
      return updated;
    }),
  })),
  removeStandardLineItem: (id) => set((state) => ({
    standardLineItems: state.standardLineItems.filter((item) => item.id !== id),
  })),
  clearStandardLineItems: () => set({ standardLineItems: [] }),

  featureOptionsMap: {},
  setFeatureOptionsMap: (map) => set({ featureOptionsMap: map }),
}));
