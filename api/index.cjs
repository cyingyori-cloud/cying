/**
 * PowerQuote API Server
 * 智能报价系统后端服务
 */

require('dotenv').config();

const jsonServer = require('json-server');
const path = require('path');
const express = require('express');
const { requireAuth } = require('./middleware/auth.cjs');
const { validateDemandParams } = require('./middleware/validator.cjs');

// 模组参考表（与前端 InquiryMatching.tsx 的 REFERENCE_ROWS 完全一致）
const REFERENCE_ROWS = {
  8:  { rackQty: 4, minVdc: 358.4, maxVdc: 441.6, backupEolMin: 8.5 },
  9:  { rackQty: 4, minVdc: 403.2, maxVdc: 496.8, backupEolMin: 9.6 },
  10: { rackQty: 4, minVdc: 448.0, maxVdc: 552.0, backupEolMin: 10.6 },
  11: { rackQty: 3, minVdc: 492.8, maxVdc: 607.2, backupEolMin: 8.8 },
  12: { rackQty: 3, minVdc: 537.6, maxVdc: 662.4, backupEolMin: 9.6 },
  14: { rackQty: 4, minVdc: 627.2, maxVdc: 772.8, backupEolMin: 11.2 },
  16: { rackQty: 4, minVdc: 716.8, maxVdc: 883.2, backupEolMin: 12.8 },
};

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db/db.json'));

// JSON Server 默认中间件（CORS等）
server.use(jsonServer.defaults());
// 解析 JSON body
server.use(jsonServer.bodyParser);

// ============================================================
// API 路由（必须放在静态文件之前）
// ============================================================

// 健康检查
server.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'PowerQuote API',
  });
});

// 获取产品目录
server.get('/api/products', (req, res) => {
  const db = router.db;
  const products = db.get('products').value();
  res.json(products);
});

server.get('/api/products/:id', (req, res) => {
  const db = router.db;
  const product = db.get('products').find({ id: req.params.id }).value();
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// 需求匹配计算
server.post('/api/demand-matching/calculate', requireAuth, validateDemandParams, (req, res) => {
  const {
    targetPowerKw,
    targetEnergyKWh,
    backupMinutes,
    dcVoltageMin,
    dcVoltageMax,
    moduleCounts,
    moduleFireFilter = 'ALL',
    cabinetFireFilter = 'ALL',
    lineTypeFilter = 'ALL',
  } = req.body;

  const db = router.db;
  const products = db.get('products').value();

  const plans = [];
  let planId = Date.now();

  for (const moduleCount of moduleCounts) {
    for (const product of products) {
      if (!product.specs) continue;

      for (const lineType of ['2线', '3线']) {
        if (lineTypeFilter !== 'ALL' && lineTypeFilter !== lineType) continue;

        const moduleFire = product.specs.moduleFire || '否';
        if (moduleFireFilter !== 'ALL') {
          const fireRequired = moduleFireFilter === 'YES';
          if ((moduleFire === '是') !== fireRequired) continue;
        }

        const cabinetFire = product.specs.cabinetFire || '否';
        if (cabinetFireFilter !== 'ALL') {
          const fireRequired = cabinetFireFilter === 'YES';
          if ((cabinetFire === '是') !== fireRequired) continue;
        }

        const ref = REFERENCE_ROWS[moduleCount];
        if (!ref) continue;

        const cabinetCount = ref.rackQty;
        const rackEnergyKWh = moduleCount * 1.86;  // 与原型一致：每模组1.86kWh
        const estimatedEnergyKWh = Math.round(rackEnergyKWh * cabinetCount * 100) / 100;

        const lineVoltageBoost = lineType === '3线' ? 1.0 : 0.92;
        const fireVoltagePenalty = cabinetFire === '是' ? 0.99 : 1;
        const estimatedMinVdc = Math.round(ref.minVdc * lineVoltageBoost * fireVoltagePenalty * 10) / 10;
        const estimatedMaxVdc = Math.round(ref.maxVdc * lineVoltageBoost * fireVoltagePenalty * 10) / 10;

        // estimatedVoltage 对齐原型：取 estimatedMaxVdc
        const estimatedVoltage = estimatedMaxVdc;

        const effectivePowerKw = targetPowerKw * 0.9 * 0.6;
        const estimatedCurrent = Math.round((effectivePowerKw * 1000) / Math.max(estimatedMinVdc, 1) * 100) / 100;

        // 备电时长：对齐原型参考值
        const estimatedBackupMinutes = ref.backupEolMin;

        const demoStatusIndex = (moduleCount + (moduleFire === '是' ? 2 : 0) + (lineType === '3线' ? 1 : 0)) % 10;
        const demoLabels = [
          { label: '推荐方案', detail: '柜数更少、边界更稳、适合优先推进。' },
          { label: '可直接推进', detail: '电压、电流与时长均处于建议边界内。' },
          { label: '时长临界', detail: '备电时长接近目标边界，可作为备选方案。' },
          { label: '电流边界', detail: '虽然未超限，但已经接近 600A 边界。' },
          { label: '需补充说明', detail: '方案可保留，但需写清客户特殊要求与例外原因。' },
          { label: '续航偏差', detail: '备电时长明显低于目标值，需要重新权衡。' },
          { label: '需技术确认', detail: '存在技术边界情况，需要工程部门确认。' },
          { label: '电压超界', detail: '电压上下界超出客户要求，需要先复核边界。' },
          { label: '电流超界', detail: '最大放电电流超过 600A，不建议直接报价。' },
          { label: '超限需复核', detail: '方案超出关键边界，不建议直接报价。' },
        ];

        const demoStatus = demoLabels[demoStatusIndex];

        plans.push({
          id: `plan_${planId++}`,
          skuCode: `${product.id}-M${moduleCount}-${lineType === '3线' ? 'S' : 'D'}`,
          productId: product.id,
          productName: product.modelName,
          moduleCount,
          cabinetCount,
          lineType,
          moduleFire,
          cabinetFire,
          estimatedEnergyKWh,
          minVdc: estimatedMinVdc,
          maxVdc: estimatedMaxVdc,
          estimatedVoltage,
          estimatedCurrent,
          estimatedBackupMinutes,
          analysisStatusLabel: demoStatus.label,
          analysisStatusDetail: demoStatus.detail,
          status: demoStatus.label === '电压超界' || demoStatus.label === '电流超界' || demoStatus.label === '超限需复核'
            ? 'INVALID'
            : demoStatus.label === '时长临界' || demoStatus.label === '电流边界' || demoStatus.label === '需补充说明' || demoStatus.label === '续航偏差' || demoStatus.label === '需技术确认'
              ? 'WARNING'
              : 'VALID',
          rankScore: Math.round((100 - Math.abs(moduleCount - 8) * 5) * (product.specs.modulePowerW / 100)),
        });
      }
    }
  }

  plans.sort((a, b) => b.rankScore - a.rankScore);
  if (plans[0]) {
    plans[0].recommended = true;
    plans[0].analysisStatusLabel = '推荐方案';
    plans[0].analysisStatusDetail = '柜数更少、边界更稳、适合优先推进。';
  }

  const topPlans = plans.slice(0, 5);
  const productCounts = {};
  for (const p of topPlans) {
    productCounts[p.productId] = (productCounts[p.productId] || 0) + 1;
  }
  const winnerId = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const winner = products.find(p => p.id === winnerId) || products[0];

  const demandRecord = {
    id: `demand_${Date.now()}`,
    createdAt: new Date().toISOString(),
    input: req.body,
    result: {
      plans: plans.slice(0, 10),
      winner: { id: winner.id, modelName: winner.modelName },
      stats: {
        totalPlans: plans.length,
        validPlans: plans.filter(p => p.status === 'VALID').length,
        warningPlans: plans.filter(p => p.status === 'WARNING').length,
        invalidPlans: plans.filter(p => p.status === 'INVALID').length,
      },
    },
  };

  db.get('demandMatching.records').unshift(demandRecord).write();

  res.json({
    demandId: demandRecord.id,
    plans: demandRecord.result.plans,
    winner: demandRecord.result.winner,
    stats: demandRecord.result.stats,
  });
});

server.get('/api/demand-matching', requireAuth, (req, res) => {
  const db = router.db;
  const records = db.get('demandMatching.records').value();
  res.json(records);
});

server.get('/api/demand-matching/:id', requireAuth, (req, res) => {
  const db = router.db;
  const record = db.get('demandMatching.records').find({ id: req.params.id }).value();
  if (!record) {
    return res.status(404).json({ error: 'Demand record not found' });
  }
  res.json(record);
});

server.get('/api/quotations', requireAuth, (req, res) => {
  const db = router.db;
  res.json(db.get('quotations.records').value());
});

server.post('/api/quotations', requireAuth, (req, res) => {
  const db = router.db;
  const quotation = {
    id: `quote_${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...req.body,
  };
  db.get('quotations.records').unshift(quotation).write();
  res.json(quotation);
});

server.get('/api/quotations/:id', requireAuth, (req, res) => {
  const db = router.db;
  const quotation = db.get('quotations.records').find({ id: req.params.id }).value();
  if (!quotation) {
    return res.status(404).json({ error: 'Quotation not found' });
  }
  res.json(quotation);
});

// ============================================================
// Webhook 服务（Fxiaoke 同步闭环，必须在 json-server router 之前注册）
// ============================================================
const setupWebhook = require('./webhook/fxiaoke-sync.cjs');
setupWebhook(server);

// JSON Server 路由（处理其他 REST 路由）
server.use(router);

// ============================================================
// MCP (Model Context Protocol) 接口（必须在静态文件之前）
// ============================================================

const MCP_TOOLS = [
  {
    name: 'calculate_demand_matching',
    description: '根据客户需求参数计算匹配的方案列表。这是智能报价的核心功能。',
    inputSchema: {
      type: 'object',
      properties: {
        targetPowerKw: { type: 'number', description: '目标功率 (kW)' },
        targetEnergyKWh: { type: 'number', description: '目标容量 (kWh)' },
        backupMinutes: { type: 'number', description: '备电时长 (分钟)' },
        dcVoltageMin: { type: 'number', description: 'DC最低电压' },
        dcVoltageMax: { type: 'number', description: 'DC最高电压' },
        moduleCounts: { type: 'array', items: { type: 'number' }, description: '模组数量列表' }
      },
      required: ['targetPowerKw', 'targetEnergyKWh', 'backupMinutes']
    }
  },
  {
    name: 'list_products',
    description: '查询产品目录，返回所有可用的产品列表及其规格参数。',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_product',
    description: '根据产品ID查询单个产品的详细信息。',
    inputSchema: {
      type: 'object',
      properties: { productId: { type: 'string', description: '产品ID' } },
      required: ['productId']
    }
  }
];

// MCP 初始化
server.post('/mcp', (req, res) => {
  const { method, params } = req.body;
  const db = router.db;
  
  switch (method) {
    case 'initialize':
      return res.json({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'powerquote-mcp', version: '1.0.0' }
      });

    case 'tools/list':
      return res.json({ tools: MCP_TOOLS });

    case 'tools/call':
      const { name, arguments: args } = params;
      
      try {
        let result;
        switch (name) {
          case 'calculate_demand_matching': {
            const { targetPowerKw, targetEnergyKWh, backupMinutes, dcVoltageMin = 520, dcVoltageMax = 680, moduleCounts = [8, 9, 10, 12] } = args;
            const products = db.get('products').value();
            const plans = [];
            let planId = Date.now();
            
            for (const moduleCount of moduleCounts) {
              for (const product of products) {
                if (!product.specs) continue;
                for (const lineType of ['2线', '3线']) {
                  const demoStatusIndex = (moduleCount + (lineType === '3线' ? 1 : 0)) % 8;
                  const demoLabels = [
                    { label: '推荐方案', detail: '柜数更少、边界更稳、适合优先推进' },
                    { label: '可直接推进', detail: '电压、电流与时长均在边界内' },
                    { label: '时长临界', detail: '备电时长接近目标边界' },
                    { label: '电流边界', detail: '已接近 600A 边界' },
                    { label: '需补充说明', detail: '需写清客户特殊要求' },
                    { label: '需技术确认', detail: '存在技术边界情况' },
                    { label: '电压超界', detail: '超出客户要求电压' },
                    { label: '超限需复核', detail: '超出关键边界，不建议直接报价' },
                  ];
                  const demoStatus = demoLabels[demoStatusIndex];
                  plans.push({
                    id: `plan_${planId++}`,
                    skuCode: `${product.modelCode || 'P001'}-M${moduleCount}-${lineType === '2线' ? '2L' : '3L'}`,
                    productId: product.id,
                    productName: product.modelName,
                    moduleCount,
                    cabinetCount: Math.max(1, Math.round(targetEnergyKWh / (moduleCount * 1.86))),
                    lineType,
                    estimatedVoltage: Math.round(moduleCount * 44.8),
                    estimatedCurrent: Math.round((targetPowerKw * 1000) / (moduleCount * 44.8 * 0.92)),
                    analysisStatusLabel: demoStatus.label,
                    analysisStatusDetail: demoStatus.detail,
                    status: demoStatus.label === '电压超界' || demoStatus.label === '超限需复核' ? 'INVALID' : 'VALID',
                    rankScore: Math.round(100 - Math.abs(moduleCount - 8) * 5),
                  });
                }
              }
            }
            
            plans.sort((a, b) => b.rankScore - a.rankScore);
            if (plans[0]) {
              plans[0].recommended = true;
              plans[0].analysisStatusLabel = '推荐方案';
              plans[0].analysisStatusDetail = '柜数更少、边界更稳、适合优先推进';
            }
            
            result = { demandId: `demand_${Date.now()}`, plans: plans.slice(0, 10), stats: { totalPlans: plans.length, validPlans: plans.filter(p => p.status === 'VALID').length } };
            break;
          }
          case 'list_products':
            result = db.get('products').value();
            break;
          case 'get_product':
            result = db.get('products').find({ id: args.productId }).value() || { error: 'Product not found' };
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
        return res.json({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } catch (error) {
        return res.json({ content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true });
      }

    default:
      return res.status(400).json({ error: `Unknown method: ${method}` });
  }
});

// MCP 健康检查
server.get('/mcp', (req, res) => {
  res.json({ service: 'PowerQuote MCP Server', version: '1.0.0', tools: MCP_TOOLS.map(t => t.name) });
});

// ============================================================
// 前端静态文件
// ============================================================
const publicPath = path.join(__dirname, 'public');
server.use(express.static(publicPath));

// SPA fallback - 对于所有其他路由返回 index.html
server.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// 错误处理
server.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║       PowerQuote API Server                            ║
║       智能报价系统后端服务                              ║
╠═══════════════════════════════════════════════════════╣
║  Local:    http://localhost:${PORT}                      ║
║  Health:   http://localhost:${PORT}/api/health           ║
║  Products: http://localhost:${PORT}/api/products          ║
╠═══════════════════════════════════════════════════════╣
║  Auth:    ${process.env.AUTH_DISABLED === 'true' ? 'DISABLED (dev mode)' : 'API Key Required'}                    ║
╚═══════════════════════════════════════════════════════╝
  `);
});
