import { useState } from 'react';
import { ChevronRight, ChevronDown, Boxes, Plus, Edit2, FolderOpen } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { mockCatalogs } from '../data/mockData';
import type { ProductCatalog as Catalog } from '../types';

function buildTree(catalogs: Catalog[]): Catalog[] {
  const map: Record<number, Catalog> = {};
  const roots: Catalog[] = [];
  catalogs.forEach((c) => { map[c.id] = { ...c, children: [] }; });
  catalogs.forEach((c) => {
    if (c.parentId) {
      map[c.parentId]?.children?.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });
  return roots;
}

function CatalogNode({ node, depth = 0 }: { node: Catalog; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer ${depth > 0 ? 'ml-6 border-l border-slate-100 pl-6' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-slate-400">
          {hasChildren ? (
            expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />
          ) : (
            <div className="w-4" />
          )}
        </div>
        <div className={`p-2 rounded-lg ${depth === 0 ? 'bg-blue-50' : 'bg-slate-50'}`}>
          {depth === 0
            ? <FolderOpen size={15} className="text-blue-500" />
            : <Boxes size={14} className="text-slate-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-800 text-sm">{node.catalogName}</span>
            <span className="text-xs text-slate-400 font-mono">{node.catalogCode}</span>
            <Badge variant={node.status === 'ACTIVE' ? 'success' : 'default'} className="text-[10px]">
              {node.status === 'ACTIVE' ? '启用' : '禁用'}
            </Badge>
            {depth === 0 && (
              <Badge variant="info" className="text-[10px]">一级</Badge>
            )}
          </div>
          {node.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{node.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
            <Edit2 size={13} />
          </button>
          <button className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors">
            <Plus size={13} />
          </button>
        </div>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <CatalogNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductCatalog() {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ catalogCode: '', catalogName: '', parentId: '', description: '' });
  const tree = buildTree(mockCatalogs);
  const l1 = mockCatalogs.filter((c) => c.level === 1).length;
  const l2 = mockCatalogs.filter((c) => c.level === 2).length;
  const active = mockCatalogs.filter((c) => c.status === 'ACTIVE').length;

  return (
    <div className="p-6 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '一级目录', value: l1, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '二级目录', value: l2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: '已启用', value: active, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">产品目录树形结构</h3>
              <p className="text-xs text-slate-400 mt-0.5">支持多层级分类管理，点击节点可展开/折叠</p>
            </div>
            <Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>新建目录</Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-1">
            {tree.map((node) => (
              <CatalogNode key={node.id} node={node} />
            ))}
          </div>
        </CardBody>
      </Card>

      {/* All catalogs table */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900">目录清单</h3>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">目录代码</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">目录名称</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">层级</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">描述</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mockCatalogs.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3">
                    <span className="font-mono text-sm text-slate-700">{c.catalogCode}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      {c.level > 1 && <span className="text-slate-300">└</span>}
                      <span className="text-sm font-medium text-slate-900">{c.catalogName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={c.level === 1 ? 'info' : 'default'}>
                      {c.level === 1 ? '一级目录' : '二级目录'}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm text-slate-500">{c.description ?? '-'}</span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : 'default'}>
                      {c.status === 'ACTIVE' ? '启用' : '禁用'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="新建产品目录" size="md">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">目录代码 *</label>
            <input
              type="text"
              value={form.catalogCode}
              onChange={(e) => setForm({ ...form, catalogCode: e.target.value })}
              placeholder="如: CAT-HV-NEW"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">目录名称 *</label>
            <input
              type="text"
              value={form.catalogName}
              onChange={(e) => setForm({ ...form, catalogName: e.target.value })}
              placeholder="输入目录名称"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">父级目录</label>
            <select
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
            >
              <option value="">无（一级目录）</option>
              {mockCatalogs.filter((c) => c.level === 1).map((c) => (
                <option key={c.id} value={c.id}>{c.catalogName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="输入目录描述..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>取消</Button>
            <Button className="flex-1" onClick={() => setModalOpen(false)}>创建目录</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
