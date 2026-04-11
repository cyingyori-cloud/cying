import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Settings, Sliders, Tag, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import {
  demoDataNotice, mockFeatureGroups, mockFeatures, mockModels, mockOptions as initialMockOptions, mockProductFeatureRels,
} from '../data/mockData';
import type { FeatureGroup, Feature, FeatureOption } from '../types';

function OptionRow({ opt, onSetDefault }: { opt: FeatureOption; onSetDefault: (id: number) => void }) {
  return (
    <div 
      className="flex items-center gap-3 py-2.5 px-4 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer"
      onClick={() => onSetDefault(opt.id)}
      role="button"
      tabIndex={0}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${opt.isDefault ? 'border-blue-500' : 'border-slate-300 group-hover:border-blue-400'}`}>
          {opt.isDefault && <div className="w-3 h-3 rounded-full bg-blue-500" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">{opt.optionName}</span>
          {opt.isDefault && <Badge variant="info" className="text-[10px] py-0">默认</Badge>}
          {opt.status === 'INACTIVE' && <Badge variant="default" className="text-[10px] py-0">已禁用</Badge>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
          <span>代码: {opt.optionCode}</span>
          {opt.optionValue && <span>值: {opt.optionValue}</span>}
          <span className="font-mono">成本: ¥{opt.cost.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm shrink-0">
        <div className="text-right">
          <p className="text-xs text-slate-400">价格影响</p>
          <p className={`font-semibold ${opt.priceImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {opt.priceImpact >= 0 ? '+' : ''}¥{opt.priceImpact.toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">性能评分</p>
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
                style={{ width: `${opt.performanceScore}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-700">{opt.performanceScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ feature, options, onSetDefault }: { feature: Feature, options: FeatureOption[], onSetDefault: (id: number, featureId: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const featureOptions = options.filter((o) => o.featureId === feature.id);

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left"
      >
        <Sliders size={15} className="text-blue-500 shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-slate-800">{feature.featureName}</span>
          <span className="ml-2 text-xs text-slate-400 font-mono">{feature.featureCode}</span>
        </div>
        <Badge variant={
          feature.featureType === 'SINGLE_SELECT' ? 'info'
            : feature.featureType === 'MULTI_SELECT' ? 'purple'
              : 'default'
        }>
          {feature.featureType === 'SINGLE_SELECT' ? '单选'
            : feature.featureType === 'MULTI_SELECT' ? '多选'
              : '输入'}
        </Badge>
        <span className="text-xs text-slate-400">{options.length} 个选项</span>
        {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      {expanded && (
        <div className="p-2 space-y-0.5">
          {featureOptions.map((opt) => (
            <OptionRow key={opt.id} opt={opt} onSetDefault={(id) => onSetDefault(id, feature.id)} />
          ))}
          {featureOptions.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-4">暂无选项</p>
          )}
        </div>
      )}
    </div>
  );
}

function GroupSection({ group, options, onSetDefault }: { group: FeatureGroup, options: FeatureOption[], onSetDefault: (id: number, featureId: number) => void }) {
  const [expanded, setExpanded] = useState(true);
  const features = mockFeatures.filter((f) => f.featureGroupId === group.id);

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <Settings size={16} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">{group.groupName}</h3>
          {group.description && <p className="text-xs text-slate-400 mt-0.5">{group.description}</p>}
        </div>
        <span className="text-xs text-slate-400">{features.length} 个特征</span>
        {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      {expanded && (
        <div className="px-6 pb-4 space-y-2">
          {features.map((f) => (
            <FeatureRow key={f.id} feature={f} options={options} onSetDefault={onSetDefault} />
          ))}
        </div>
      )}
    </Card>
  );
}

export function FeaturesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({ code: '', name: '', description: '' });
  
  // Use state for options to allow toggling defaults
  const [options, setOptions] = useState<FeatureOption[]>(initialMockOptions);

  const handleSetDefault = (optionId: number, featureId: number) => {
    setOptions(currentOptions => 
      currentOptions.map(opt => {
        if (opt.featureId === featureId) {
          // Set to true if it's the clicked option, false otherwise
          return { ...opt, isDefault: opt.id === optionId };
        }
        return opt;
      })
    );
  };

  // Summarize product-feature associations
  const model1Rels = mockProductFeatureRels.filter((r) => r.productModelId === 1);
  const flagshipModel = mockModels.find((model) => model.id === 1);

  return (
    <div className="p-6 space-y-4">
      <Card className="border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <Tag size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">储能特征配置库</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{demoDataNotice}</p>
          </div>
        </div>
      </Card>

      {/* Header actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 rounded-xl p-3">
            <Tag size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">特征配置库</h2>
            <p className="text-xs text-slate-400">{mockFeatureGroups.length} 个特征组 · {mockFeatures.length} 个特征 · {options.length} 个选项</p>
          </div>
        </div>
        <Button icon={<Plus size={16} />} size="sm" onClick={() => setIsModalOpen(true)}>新建特征组</Button>
      </div>

      {/* Product-Feature Association Summary */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900">产品特征关联配置</h3>
          <p className="text-xs text-slate-400 mt-0.5">{flagshipModel?.modelName ?? '旗舰型号'} 的默认 CPQ 特征</p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {model1Rels.map((rel) => {
              const feature = mockFeatures.find((f) => f.id === rel.featureId);
              // Find default option in our state
              const defaultOpt = options.find((o) => o.featureId === rel.featureId && o.isDefault) || 
                                 options.find((o) => o.id === rel.defaultOptionId);
              return (
                <div key={rel.id} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="text-xs font-medium text-slate-700">{feature?.featureName}</span>
                  </div>
                  <Badge variant={rel.isRequired ? 'danger' : 'default'} className="text-[10px]">
                    {rel.isRequired ? '必选' : '可选'}
                  </Badge>
                  {defaultOpt && (
                    <p className="text-xs text-slate-400 mt-1.5 truncate">默认: {defaultOpt.optionName}</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Feature Groups */}
      <div className="space-y-4">
        {mockFeatureGroups.map((group) => (
          <GroupSection key={group.id} group={group} options={options} onSetDefault={handleSetDefault} />
        ))}
      </div>

      {/* Create Feature Group Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="新建特征组">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">特征组代码</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="例如: GRP-XXX"
              value={newGroup.code}
              onChange={(e) => setNewGroup({ ...newGroup, code: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">特征组名称</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="例如: 核心部件配置"
              value={newGroup.name}
              onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              rows={3}
              placeholder="特征组说明..."
              value={newGroup.description}
              onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
            />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>取消</Button>
            <Button onClick={() => {
              // Add mock save logic here later
              setIsModalOpen(false);
              setNewGroup({ code: '', name: '', description: '' });
            }}>保存特征组</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
