import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Edit2, Trash2, Package, Eye, BatteryCharging, ShieldCheck, Database, RefreshCw, Link2,
} from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { demoDataNotice, mockCatalogs } from '../data/mockData';
import {
  createFxiaokeProduct,
  loadFxiaokeProducts,
  type FxiaokeProductsSnapshot,
} from '../data/fxiaokeProducts';
import { roleViewMap } from '../data/roleViews';
import { useAppStore } from '../store/appStore';
import type { ProductModel } from '../types';

const getCatalogName = (catalogId: number) => mockCatalogs.find((catalog) => catalog.id === catalogId)?.catalogName ?? '-';

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`;
}

function getCapability(product: ProductModel) {
  const chunks = [];
  if (product.ratedPowerKw) chunks.push(`${product.ratedPowerKw}kW`);
  if (product.ratedEnergyKWh) chunks.push(`${product.ratedEnergyKWh}kWh`);
  return chunks.length > 0 ? chunks.join(' / ') : '公开参数整理中';
}

const emptyModel: Omit<ProductModel, 'id' | 'createdAt' | 'updatedAt'> = {
  catalogId: 4,
  modelCode: '',
  modelName: '',
  description: '',
  classification: '',
  baseCost: 0,
  basePrice: 0,
  status: 'ACTIVE',
};

interface ProductFormState extends Omit<ProductModel, 'id' | 'createdAt' | 'updatedAt'> {
  liveCategoryValue: string;
}

const emptyFormState: ProductFormState = {
  ...emptyModel,
  liveCategoryValue: '',
};

type DisplayRow =
  | {
    source: 'live';
    key: string;
    modelCode: string;
    modelName: string;
    description?: string | null;
    directoryCapability: string;
    basePrice: number;
    baseCost?: number | null;
    status: 'ACTIVE' | 'INACTIVE';
    statusLabel: string;
    crmId: string;
    sourceFields: Record<string, unknown>;
  }
  | {
    source: 'local';
    key: string;
    modelCode: string;
    modelName: string;
    description?: string;
    directoryCapability: string;
    basePrice: number;
    baseCost?: number;
    status: 'ACTIVE' | 'INACTIVE';
    statusLabel: string;
    localProduct: ProductModel;
  };

export function ProductModels() {
  const { products, addProduct, updateProduct, deleteProduct, currentRole } = useAppStore();
  const roleInfo = roleViewMap[currentRole];
  const canEdit = currentRole === 'product';
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<ProductModel | null>(null);
  const [form, setForm] = useState<ProductFormState>({ ...emptyFormState });
  const [viewRow, setViewRow] = useState<DisplayRow | null>(null);
  const [fxiaokeSnapshot, setFxiaokeSnapshot] = useState<FxiaokeProductsSnapshot | null>(null);
  const [fxiaokeLoading, setFxiaokeLoading] = useState(true);
  const [fxiaokeError, setFxiaokeError] = useState('');
  const [savingToFxiaoke, setSavingToFxiaoke] = useState(false);
  const [createSuccessMessage, setCreateSuccessMessage] = useState('');
  const [highlightModelCode, setHighlightModelCode] = useState('');

  const loadSnapshot = async (refresh?: boolean) => {
    setFxiaokeLoading(true);
    setFxiaokeError('');
    try {
      const snapshot = await loadFxiaokeProducts({ refresh });
      setFxiaokeSnapshot(snapshot);
      if (!snapshot) {
        setFxiaokeError('未能读取纷享销客实时桥接或静态同步文件');
      }
    } catch (error) {
      setFxiaokeError(error instanceof Error ? error.message : '读取纷享销客数据失败');
    } finally {
      setFxiaokeLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot();
  }, []);

  useEffect(() => {
    if (!fxiaokeSnapshot?.categoryChoices?.length) return;
    setForm((current) => (
      current.liveCategoryValue
        ? current
        : { ...current, liveCategoryValue: fxiaokeSnapshot.categoryChoices?.[0]?.value ?? '' }
    ));
  }, [fxiaokeSnapshot]);

  const liveRows = useMemo<DisplayRow[]>(() => {
    if (!fxiaokeSnapshot) return [];
    return fxiaokeSnapshot.mappedModels
      .filter((item) => {
        const text = [item.modelCode, item.modelName, item.directoryCapability].filter(Boolean).join(' ');
        return text.includes(search);
      })
      .map((item) => ({
        source: 'live',
        key: `live-${item.crmId}`,
        modelCode: item.modelCode,
        modelName: item.modelName,
        description: item.description ?? null,
        directoryCapability: item.directoryCapability,
        basePrice: item.basePrice,
        baseCost: item.baseCost ?? null,
        status: item.status,
        statusLabel: item.statusLabel,
        crmId: item.crmId,
        sourceFields: item.sourceFields,
      }));
  }, [fxiaokeSnapshot, search]);

  const localRows = useMemo<DisplayRow[]>(() => (
    products
      .filter((product) =>
        product.modelName.includes(search)
          || product.modelCode.includes(search)
          || (product.classification ?? '').includes(search)
          || (product.applicationScenarios ?? []).some((scenario) => scenario.includes(search)))
      .map((product) => ({
        source: 'local',
        key: `local-${product.id}`,
        modelCode: product.modelCode,
        modelName: product.modelName,
        description: product.description,
        directoryCapability: [getCatalogName(product.catalogId), product.classification, getCapability(product)].filter(Boolean).join(' / '),
        basePrice: product.basePrice,
        baseCost: product.baseCost,
        status: product.status,
        statusLabel: product.status === 'ACTIVE' ? '启用' : '禁用',
        localProduct: product,
      }))
  ), [products, search]);

  const isLiveMode = liveRows.length > 0;
  const displayRows = isLiveMode ? liveRows : localRows;

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyFormState,
      liveCategoryValue: fxiaokeSnapshot?.categoryChoices?.[0]?.value ?? '',
    });
    setModalOpen(true);
  };

  const openEdit = (product: ProductModel) => {
    setEditing(product);
    setForm({
      catalogId: product.catalogId,
      modelCode: product.modelCode,
      modelName: product.modelName,
      description: product.description ?? '',
      classification: product.classification ?? '',
      baseCost: product.baseCost ?? 0,
      basePrice: product.basePrice,
      status: product.status,
      liveCategoryValue: '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.modelCode || !form.modelName) return;

    if (isLiveMode) {
      setSavingToFxiaoke(true);
      setFxiaokeError('');
      try {
        const snapshot = await createFxiaokeProduct({
          modelCode: form.modelCode,
          modelName: form.modelName,
          categoryValue: form.liveCategoryValue,
          classification: form.classification,
          basePrice: form.basePrice,
          status: form.status,
          description: form.description,
        });
        setFxiaokeSnapshot(snapshot);
        setCreateSuccessMessage(`"${form.modelName}" 已写入纷享销客 ProductObj，并同步到当前产品型号主表。`);
        setHighlightModelCode(form.modelCode);
        window.setTimeout(() => {
          setHighlightModelCode('');
        }, 5000);
        setModalOpen(false);
        setForm({ ...emptyFormState });
      } catch (error) {
        setFxiaokeError(error instanceof Error ? error.message : '写入纷享销客失败');
      } finally {
        setSavingToFxiaoke(false);
      }
      return;
    }

    if (editing) {
      updateProduct({ ...editing, ...form, updatedAt: new Date().toISOString() });
    } else {
      addProduct({
        id: Date.now(),
        ...form,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    setModalOpen(false);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('确认删除该产品型号？')) {
      deleteProduct(id);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <BatteryCharging size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{roleInfo.label}下的产品主数据</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{demoDataNotice}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant={isLiveMode ? 'success' : 'warning'}>
                {isLiveMode ? '纷享销客实时产品表' : '本地演示产品表'}
              </Badge>
              {fxiaokeSnapshot?.mapping?.length ? (
                <Badge variant="info">已加载映射表 {fxiaokeSnapshot.mapping.length} 项</Badge>
              ) : null}
              {fxiaokeError ? (
                <span className="text-[11px] text-red-500">{fxiaokeError}</span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  {isLiveMode
                    ? '主表已由纷享销客实时映射结果接管，新建会直接写入 CRM。'
                    : '当前桥接不可用，主表回退为本地演示数据。'}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {createSuccessMessage && (
        <Card className="border border-emerald-200 bg-emerald-50/70">
          <div className="px-5 py-4 flex items-start gap-3">
            <ShieldCheck size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">CRM 写入成功</p>
              <p className="text-xs text-slate-600 mt-1">{createSuccessMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setCreateSuccessMessage('')}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              关闭
            </button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 min-w-[320px] max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索型号、场景、产品线..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => void loadSnapshot(true)}
                disabled={fxiaokeLoading}
                icon={<RefreshCw size={14} className={fxiaokeLoading ? 'animate-spin' : ''} />}
              >
                实时刷新
              </Button>
            </div>
            {canEdit && (
              <Button icon={<Plus size={16} />} onClick={openCreate}>新建产品型号</Button>
            )}
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">产品型号</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">产品名称</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">产品分类</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">定价</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">估算成本</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">状态</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayRows.map((row) => (
                <tr
                  key={row.key}
                  className={`hover:bg-slate-50/50 transition-colors ${
                    highlightModelCode && row.modelCode === highlightModelCode ? 'bg-emerald-50/70 ring-1 ring-inset ring-emerald-200' : ''
                  }`}
                >
                  <td className="px-6 py-4 w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        {row.source === 'live' ? <Link2 size={14} className="text-emerald-500" /> : <Package size={14} className="text-blue-500" />}
                      </div>
                      <span className="text-sm font-mono font-medium text-slate-700">{row.modelCode || '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 min-w-[320px]">
                    <p className="text-sm font-medium text-slate-900 max-w-[360px] truncate">{row.modelName}</p>
                    <p className="text-xs text-slate-400 max-w-[360px] truncate mt-0.5">
                      {row.description || (row.source === 'live' ? `CRM记录 ${row.crmId}` : '演示产品主数据')}
                    </p>
                  </td>
                  <td className="px-6 py-4 w-[260px]">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{row.directoryCapability || '—'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.basePrice)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm text-slate-500">{row.baseCost != null ? formatCurrency(row.baseCost) : '—'}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge variant={row.status === 'ACTIVE' ? 'success' : 'default'}>
                      {row.statusLabel}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setViewRow(row);
                          setDetailOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                        title="查看详情"
                      >
                        <Eye size={15} />
                      </button>
                      {row.source === 'local' && canEdit && (
                        <>
                          <button
                            onClick={() => openEdit(row.localProduct)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                            title="编辑"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(row.localProduct.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayRows.length === 0 && (
            <div className="py-16 text-center text-slate-400">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p>暂无产品型号数据</p>
            </div>
          )}
        </div>
      </Card>

      {canEdit && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={isLiveMode ? '新建并写入纷享销客产品' : (editing ? '编辑产品型号' : '新建产品型号')}
          size="lg"
        >
          <div className="p-6 space-y-4">
            {isLiveMode && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 leading-relaxed">
                当前表单会通过 bridge 直接写入纷享销客 `ProductObj`。
                已按你的映射表处理：`产品编码 → 产品型号`、`产品名称 → 产品名称`、`价格 → 定价`、`上下架 → 状态`。
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">产品型号 *</label>
                <input
                  type="text"
                  value={form.modelCode}
                  onChange={(event) => setForm({ ...form, modelCode: event.target.value })}
                  placeholder="如: PQ-ESS-001"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                />
              </div>
              {!isLiveMode && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">所属目录</label>
                  <select
                    value={form.catalogId}
                    onChange={(event) => setForm({ ...form, catalogId: Number(event.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                  >
                    {mockCatalogs.filter((catalog) => catalog.level === 2).map((catalog) => (
                      <option key={catalog.id} value={catalog.id}>{catalog.catalogName}</option>
                    ))}
                  </select>
                </div>
              )}
              {isLiveMode && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">状态</label>
                  <select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value as 'ACTIVE' | 'INACTIVE' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                  >
                    <option value="ACTIVE">上架</option>
                    <option value="INACTIVE">下架</option>
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">产品名称 *</label>
              <input
                type="text"
                value={form.modelName}
                onChange={(event) => setForm({ ...form, modelName: event.target.value })}
                placeholder="输入完整产品名称"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">产品分类</label>
                {isLiveMode ? (
                  <>
                    <select
                      value={form.liveCategoryValue}
                      onChange={(event) => setForm({ ...form, liveCategoryValue: event.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                    >
                      {(fxiaokeSnapshot?.categoryChoices ?? []).map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label} ({choice.value}){choice.count > 0 ? ` · 已有${choice.count}条` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      下拉项来自纷享销客 `ProductObj.category` 的官方可写选项，创建时会直接按所选分类写入 CRM。
                    </p>
                  </>
                ) : (
                  <input
                    type="text"
                    value={form.classification}
                    onChange={(event) => setForm({ ...form, classification: event.target.value })}
                    placeholder="如: 工商业储能 / 150kW"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">定价 (¥)</label>
                <input
                  type="number"
                  value={form.basePrice}
                  onChange={(event) => setForm({ ...form, basePrice: Number(event.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                />
              </div>
            </div>
            {!isLiveMode && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">估算成本 (¥)</label>
                <input
                  type="number"
                  value={form.baseCost}
                  onChange={(event) => setForm({ ...form, baseCost: Number(event.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">产品描述</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
                placeholder="输入产品描述..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>取消</Button>
              <Button className="flex-1" onClick={() => void handleSave()} disabled={savingToFxiaoke}>
                {savingToFxiaoke ? '正在写入纷享销客...' : (editing ? '保存修改' : '创建产品')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="产品型号详情" size="lg">
        {viewRow && (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <Package size={28} className="text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-lg">{viewRow.modelName}</h3>
                <p className="text-sm text-slate-400 font-mono">{viewRow.modelCode}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant={viewRow.status === 'ACTIVE' ? 'success' : 'default'}>
                    {viewRow.statusLabel}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">产品分类</p>
                <p className="font-medium text-slate-900">{viewRow.directoryCapability || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">定价 / 估算成本</p>
                <p className="font-bold text-xl text-blue-600">{formatCurrency(viewRow.basePrice)}</p>
                <p className="text-xs text-slate-500 mt-1">成本 {viewRow.baseCost != null ? formatCurrency(viewRow.baseCost) : '—'}</p>
              </div>
            </div>

            {viewRow.description && (
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">产品描述</p>
                <p className="text-sm text-slate-700">{viewRow.description}</p>
              </div>
            )}

            {viewRow.source === 'live' && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 leading-relaxed">
                <p className="font-semibold mb-2">纷享销客源字段</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(viewRow.sourceFields).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="font-mono text-emerald-700">{key}</span>
                      <span className="text-slate-600 break-all">{value == null || value === '' ? '—' : String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed">
              {viewRow.source === 'live'
                ? '该型号已来自纷享销客实时桥接结果，列表刷新后会再次以 CRM 最新数据为准。'
                : demoDataNotice}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDetailOpen(false)}>关闭</Button>
              {viewRow.source === 'local' && canEdit && (
                <Button className="flex-1" onClick={() => { setDetailOpen(false); openEdit(viewRow.localProduct); }}>
                  <Edit2 size={15} /> 编辑
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
