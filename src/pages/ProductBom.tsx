import { useState } from 'react';
import { ChevronRight, ChevronDown, GitBranch, Package, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { demoDataNotice, mockBoms, mockModels } from '../data/mockData';
import type { ProductBom as BomItem } from '../types';

function buildBomTree(boms: BomItem[], parentId: number | null = null): BomItem[] {
  return boms
    .filter((b) => b.parentBomId === parentId)
    .map((b) => ({ ...b, children: buildBomTree(boms, b.id) }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function BomNode({ node, depth = 0 }: { node: BomItem; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors group ${hasChildren ? 'cursor-pointer' : ''}`}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="text-slate-300 w-4 shrink-0">
          {hasChildren
            ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
            : <div className="w-4 h-px bg-slate-200 ml-1" />}
        </div>
        <div className={`p-1.5 rounded-lg shrink-0 ${depth === 0 ? 'bg-brand-50' : 'bg-slate-100'}`}>
          <Package size={13} className={depth === 0 ? 'text-brand-500' : 'text-slate-500'} />
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center">
          <div className="col-span-4">
            <span className="text-sm font-medium text-slate-800 truncate block">{node.materialName}</span>
            <span className="text-xs font-mono text-slate-400">{node.materialCode}</span>
          </div>
          <div className="col-span-3 text-xs text-slate-500 truncate">{node.specification ?? '—'}</div>
          <div className="col-span-1 text-xs text-slate-600 text-center">{node.quantity} {node.unit}</div>
          <div className="col-span-2 text-xs font-semibold text-slate-700 text-right">
            ¥{(node.unitCost * node.quantity).toLocaleString()}
          </div>
          <div className="col-span-2 flex items-center justify-end gap-1.5">
            {node.isOptional
              ? <Badge variant="warning" className="text-[10px]">可选配</Badge>
              : <Badge variant="success" className="text-[10px]">标准件</Badge>}
            <Badge variant="default" className="text-[10px]">L{node.bomLevel}</Badge>
          </div>
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="border-l border-dashed border-slate-200 ml-8">
          {node.children!.map((child) => (
            <BomNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductBom() {
  const [selectedModelId, setSelectedModelId] = useState(1);
  const model = mockModels.find((m) => m.id === selectedModelId);
  const boms = mockBoms.filter((b) => b.productModelId === selectedModelId);
  const tree = buildBomTree(boms);

  const parentIds = new Set(boms.map((bom) => bom.parentBomId).filter((id): id is number => id != null));
  const leafBoms = boms.filter((bom) => !parentIds.has(bom.id));
  const totalCost = leafBoms.reduce((sum, bom) => sum + bom.unitCost * bom.quantity, 0);
  const optionalCount = boms.filter((b) => b.isOptional).length;
  const requiredCount = boms.filter((b) => !b.isOptional).length;

  return (
    <div className="p-6 space-y-4">
      <Card className="border border-brand-100 bg-brand-50/60 p-4">
        <div className="flex items-start gap-3">
          <GitBranch size={18} className="text-brand-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">演示级 BOM 成本拆解</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {demoDataNotice} 父项主要用于结构展示，成本统计默认按叶子物料项汇总。
            </p>
          </div>
        </div>
      </Card>

      {/* Model Selector */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-slate-500 font-medium shrink-0">选择产品型号：</span>
            {mockModels.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModelId(m.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  selectedModelId === m.id
                    ? 'border-blue-500 bg-brand-50 text-brand-700'
                    : 'border-slate-100 text-slate-600 hover:border-slate-200'
                }`}
              >
                {m.modelCode}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'BOM总项数', value: boms.length, color: 'text-brand-600' },
            { label: '标准件', value: requiredCount, color: 'text-emerald-600' },
            { label: '可选配件', value: optionalCount, color: 'text-amber-600' },
            { label: '叶子物料成本', value: `¥${totalCost.toLocaleString()}`, color: 'text-purple-600' },
          ].map((s) => (
            <Card key={s.label} className="p-4">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* BOM Tree */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <GitBranch size={16} className="text-brand-500" />
            <div>
              <h3 className="font-semibold text-slate-900">
                {model?.modelName ?? '未知产品'} — BOM物料清单
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">型号代码: {model?.modelCode}</p>
            </div>
          </div>
        </CardHeader>
        <div>
          {/* Header row */}
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="w-4 shrink-0" />
            <div className="w-6 shrink-0" />
            <div className="flex-1 grid grid-cols-12 gap-2">
              <div className="col-span-4">物料名称 / 代码</div>
              <div className="col-span-3">规格型号</div>
              <div className="col-span-1 text-center">数量</div>
              <div className="col-span-2 text-right">小计成本</div>
              <div className="col-span-2 text-right">属性</div>
            </div>
          </div>
          <div className="p-3 space-y-0.5">
            {tree.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-30" />
                <p>该产品暂无BOM数据</p>
              </div>
            ) : (
              tree.map((node) => <BomNode key={node.id} node={node} />)
            )}
          </div>
        </div>
        {boms.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">共 {boms.length} 项物料</span>
            <div className="text-right">
              <span className="text-xs text-slate-400">叶子物料成本</span>
              <p className="text-lg font-bold text-slate-900">¥{totalCost.toLocaleString()}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
