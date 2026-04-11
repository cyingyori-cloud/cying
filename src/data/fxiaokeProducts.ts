export interface FxiaokeProductRecord {
  crmId: string;
  name: string;
  englishName?: string | null;
  productCode?: string | null;
  masterCode?: string | null;
  categoryValue?: string | null;
  categoryLabel?: string | null;
  productLineValue?: string | null;
  productLineLabel?: string | null;
  productTypeValue?: string | null;
  productTypeLabel?: string | null;
  specification?: string | null;
  price?: string | null;
  isSaleable?: boolean | null;
  lifeStatusValue?: string | null;
  lifeStatusLabel?: string | null;
  onShelvesTime?: string | null;
  briefDescription?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  prototypeFit: 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
}

export interface FxiaokeProductsSnapshot {
  mode?: string;
  bridgeHost?: string;
  bridgePort?: number;
  lastRefreshAt?: number;
  syncedAt: string;
  sourceObject: string;
  total: number;
  highFitCount: number;
  mediumFitCount: number;
  mapping?: Array<{
    fxiaokeField: string;
    powerquoteField: string;
  }>;
  categoryChoices?: Array<{
    value: string;
    label: string;
    count: number;
  }>;
  items: FxiaokeProductRecord[];
  mappedModels: Array<{
    id: number;
    crmId: string;
    modelCode: string;
    modelName: string;
    directoryCapability: string;
    basePrice: number;
    baseCost?: number | null;
    description?: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    statusLabel: string;
    prototypeFit: 'HIGH' | 'MEDIUM' | 'LOW';
    sourceFields: Record<string, unknown>;
  }>;
}

const bridgeUrl = (import.meta.env.VITE_FXIAOKE_BRIDGE_URL as string | undefined)?.replace(/\/$/, '')
  ?? 'http://127.0.0.1:8787';

async function fetchSnapshot(url: string): Promise<FxiaokeProductsSnapshot | null> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return null;
  const data = (await response.json()) as FxiaokeProductsSnapshot;
  if (!data || !Array.isArray(data.items)) return null;
  return data;
}

export async function loadFxiaokeProducts(options?: { refresh?: boolean }): Promise<FxiaokeProductsSnapshot | null> {
  const query = options?.refresh ? '?refresh=1' : '';
  try {
    const live = await fetchSnapshot(`${bridgeUrl}/api/fxiaoke/products${query}`);
    if (live) return live;
  } catch {
    // fall back to static snapshot below
  }
  try {
    return await fetchSnapshot('/data/fxiaoke-products.json');
  } catch {
    return null;
  }
}

export async function createFxiaokeProduct(input: {
  modelCode: string;
  modelName: string;
  categoryValue: string;
  classification?: string;
  basePrice: number;
  status: 'ACTIVE' | 'INACTIVE';
  description?: string;
}): Promise<FxiaokeProductsSnapshot> {
  const response = await fetch(`${bridgeUrl}/api/fxiaoke/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const errorPayload = JSON.parse(text) as { shortMessage?: string; message?: string };
      throw new Error(errorPayload.shortMessage || errorPayload.message || '创建纷享销客产品失败');
    } catch {
      throw new Error(text || '创建纷享销客产品失败');
    }
  }
  return (await response.json()) as FxiaokeProductsSnapshot;
}
