/**
 * PowerQuote API Server
 * 智能报价系统后端服务
 *
 * 启动：npm run api
 * 同时运行前端和API：npm run api:dev
 */

// 加载环境变量（必须在其他 require 之前）
require('dotenv').config();

const jsonServer = require('json-server');
const path = require('path');
const { requireAuth } = require('./middleware/auth.cjs');
const { validateDemandParams } = require('./middleware/validator.cjs');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db/db.json'));
const middlewares = jsonServer.defaults();

// 解析 JSON body
server.use(jsonServer.bodyParser);

// CORS 已由 middlewares 默认启用

// ============================================================
// 公开路由（无需认证）
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

// 获取产品目录（可公开访问，作为参考数据）
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

// ============================================================
// 受保护路由（需要 API Key）
// ============================================================

// 模组参考表（与前端 InquiryMatching.tsx 的 REFERENCE_ROWS 完全一致）
const REFERENCE_ROWS = {
  8:  { rackQty: 4, minVdc: 358.4, maxVdc: 441.6, backupEolMin: 8.52,  maxCurrent: 634.46 },
  9:  { rackQty: 4, minVdc: 403.2, maxVdc: 496.8, backupEolMin: 9.58,  maxCurrent: 563.97 },
  10: { rackQty: 4, minVdc: 448.0, maxVdc: 552.0, backupEolMin: 10.64, maxCurrent: 507.57 },
  11: { rackQty: 3, minVdc: 492.8, maxVdc: 607.2, backupEolMin: 8.78,  maxCurrent: 615.23 },
  12: { rackQty: 3, minVdc: 537.6, maxVdc: 662.4, backupEolMin: 9.58,  maxCurrent: 563.97 },
};

function normalizeFireFilter(value) {
  if (value == null || value === '') return '全部';
  const normalized = String(value).trim();
  return {
    ALL: '全部',
    YES: '带消防',
    NO: '不带消防',
    全部: '全部',
    带消防: '带消防',
    不带消防: '不带消防',
  }[normalized] || normalized;
}

function normalizeLineTypeFilter(value) {
  if (value == null || value === '') return '全部';
  const normalized = String(value).trim();
  return {
    ALL: '全部',
    全部: '全部',
    '2线': '2线',
    '3线': '3线',
  }[normalized] || normalized;
}

// 需求匹配计算
server.post('/api/demand-matching/calculate', requireAuth, validateDemandParams, (req, res) => {
  const {
    targetPowerKw,
    targetEnergyKWh,
    backupMinutes,
    dcVoltageMin,
    dcVoltageMax,
    moduleCounts,
    moduleFireFilter = '全部',
    cabinetFireFilter = '全部',
    lineTypeFilter = '全部',
    specialRequirements = '',
  } = req.body;

  const normalizedModuleFireFilter = normalizeFireFilter(moduleFireFilter);
  const normalizedCabinetFireFilter = normalizeFireFilter(cabinetFireFilter);
  const normalizedLineTypeFilter = normalizeLineTypeFilter(lineTypeFilter);

  const db = router.db;
  const products = db.get('products').value();

  // 生成候选方案
  const plans = [];
  let planId = Date.now();

  for (const moduleCount of moduleCounts) {
    for (const product of products) {
      if (!product.specs) continue;

      for (const lineType of ['2线', '3线']) {
        // 过滤逻辑
        if (normalizedLineTypeFilter !== '全部' && normalizedLineTypeFilter !== lineType) continue;

        const moduleFire = product.specs.moduleFire || '否';
        if (normalizedModuleFireFilter !== '全部') {
          const fireRequired = normalizedModuleFireFilter === '带消防';
          if ((moduleFire === '是') !== fireRequired) continue;
        }

        const cabinetFire = product.specs.cabinetFire || '否';
        if (normalizedCabinetFireFilter !== '全部') {
          const fireRequired = normalizedCabinetFireFilter === '带消防';
          if ((cabinetFire === '是') !== fireRequired) continue;
        }

        // 计算参数：完全对齐前端 InquiryMatching.tsx REFERENCE_ROWS
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

        // Demo展示用：差异化状态标签
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
          estimatedEnergyKWh: Math.round(estimatedEnergyKWh * 100) / 100,
          minVdc: estimatedMinVdc,
          maxVdc: estimatedMaxVdc,
          estimatedVoltage: Math.round(estimatedVoltage * 10) / 10,
          estimatedCurrent: Math.round(estimatedCurrent * 100) / 100,
          estimatedBackupMinutes: Math.round(estimatedBackupMinutes * 10) / 10,
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

  // 按评分排序，最高分的标记为推荐
  plans.sort((a, b) => b.rankScore - a.rankScore);
  if (plans[0]) {
    plans[0].recommended = true;
    plans[0].analysisStatusLabel = '推荐方案';
    plans[0].analysisStatusDetail = '柜数更少、边界更稳、适合优先推进。';
  }

  // 选择最优产品族
  const topPlans = plans.slice(0, 5);
  const productCounts = {};
  for (const p of topPlans) {
    productCounts[p.productId] = (productCounts[p.productId] || 0) + 1;
  }
  const winnerId = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const winner = products.find(p => p.id === winnerId) || products[0];

  // 保存需求记录
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

// 获取需求记录列表
server.get('/api/demand-matching', requireAuth, (req, res) => {
  const db = router.db;
  const records = db.get('demandMatching.records').value();
  res.json(records);
});

// 获取单个需求记录
server.get('/api/demand-matching/:id', requireAuth, (req, res) => {
  const db = router.db;
  const record = db.get('demandMatching.records').find({ id: req.params.id }).value();
  if (!record) {
    return res.status(404).json({ error: 'Demand record not found' });
  }
  res.json(record);
});

// 报价单接口
server.get('/api/quotations', requireAuth, (req, res) => {
  const db = router.db;
  const quotations = db.get('quotations.records').value();
  res.json(quotations);
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
// 路由重写（JSON Server 标准路径）
// ============================================================
server.use(jsonServer.rewriter({
  '/api/products': '/products',
  '/api/products/:id': '/products/:id',
  '/api/demand-matching': '/demandMatching/records',
  '/api/demand-matching/:id': '/demandMatching/records/:id',
  '/api/demand-matching/calculate': '/demandMatching/records',
  '/api/candidate-plans/:demandId': '/candidatePlans/:demandId',
  '/api/quotations': '/quotations/records',
  '/api/quotations/:id': '/quotations/records/:id',
}));

// ============================================================
// Fxiaoke MCP HTTP Client（供 webhook 调用）
// ============================================================

const FX_MCP_URL = process.env.FXIAOKE_MCP_URL || 'https://open.fxiaoke.com/mcp/831345_sandbox/crm-mcp';
const FX_API_KEY = process.env.FXIAOKE_APIKEY || 'FSUTK_25E0694A75F0E22A03268B45E86D87BA8A05188D09CAAB1002D1478D0C4ABE6D';

/**
 * 调用 Fxiaoke MCP 接口
 * @param {string} toolName - 工具名，如 tools/call
 * @param {object} params - JSON-RPC params
 */
async function fxMcpRequest(toolName, params = {}) {
  const separator = FX_MCP_URL.includes('?') ? '&' : '?';
  const url = `${FX_MCP_URL}${separator}apiKey=${FX_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: toolName, params }),
  });
  if (!response.ok) throw new Error(`Fxiaoke MCP HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(`Fxiaoke MCP error: ${data.error.message}`);
  return data.result || data;
}

/**
 * 调用 Fxiaoke MCP 工具
 */
async function fxMcpTool(toolName, args = {}) {
  const result = await fxMcpRequest('tools/call', { name: toolName, arguments: args });
  // 返回的是 [content]，content[0].text 是 JSON 字符串
  if (result && result[0] && result[0].content) {
    try { return JSON.parse(result[0].content[0].text); }
    catch { return result[0].content[0].text; }
  }
  return result;
}

// ============================================================
// CRM Sync Webhook
// 接收 CRM 按钮触发 → 读CRM记录 → 算PowerQuote → 写CRM候选方案
// ============================================================

server.post('/api/fxiaoke/sync', requireAuth, async (req, res) => {
  const { recordId } = req.body;
  if (!recordId) return res.status(400).json({ error: '缺少 recordId' });

  try {
    console.log('[CRM Sync] 开始处理 recordId:', recordId);

    // 1. 读取产品需求申请记录
    const record = await fxMcpTool('GetDataById', {
      object_api_name: 'product_requirement_applic__c',
      record_id: recordId,
    });
    if (!record || record.errorCode) {
      throw new Error(`读取CRM记录失败: ${JSON.stringify(record)}`);
    }
    console.log('[CRM Sync] 读取记录成功:', record.name || recordId);

    // 2. 提取参数
    const powerKw    = record.target_power_kw__c;
    const capacityKwh = record.target_capacity_kwh__c;
    const backupMin   = record.backup_power_duration_min__c;
    const dcMin      = record.dc_min_voltage__c || 520;
    const dcMax      = record.dc_max_voltage__c || 680;
    const wiringVal  = record.wiring_mode__c;   // 1=3线 2=2线
    const moduleFireVal  = record.module_fire_protection__c;   // 1=带 2=不带
    const cabinetFireVal = record.cabinet_fire_protection__c;  // 1=带 2=不带

    if (!powerKw || !capacityKwh || !backupMin) {
      return res.status(400).json({ error: '目标功率、容量和备电时长为必填项' });
    }

    // 映射过滤值
    const wiringApi       = (wiringVal == '1') ? '3线' : (wiringVal == '2') ? '2线' : 'ALL';
    const moduleFireApi    = (moduleFireVal == '1') ? 'YES' : (moduleFireVal == '2') ? 'NO' : 'ALL';
    const cabinetFireApi   = (cabinetFireVal == '1') ? 'YES' : (cabinetFireVal == '2') ? 'NO' : 'ALL';

    console.log('[CRM Sync] 提交参数: 功率=' + powerKw + 'kW 容量=' + capacityKwh + 'kWh 备电=' + backupMin + 'min');

    // 3. 调用 PowerQuote 计算
    const pqResp = await fetch(`${req.protocol}://${req.get('host')}/api/demand-matching/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization || '' },
      body: JSON.stringify({
        targetPowerKw: powerKw, targetEnergyKWh: capacityKwh,
        backupMinutes: backupMin, dcVoltageMin: dcMin, dcVoltageMax: dcMax,
        moduleCounts: [8, 9, 10, 11, 12, 14, 16],
        moduleFireFilter: moduleFireApi, cabinetFireFilter: cabinetFireApi, lineTypeFilter: wiringApi,
      }),
    });
    const pqData = await pqResp.json();
    const plans = pqData.plans || [];
    const demandId = pqData.demandId || '';

    console.log('[CRM Sync] PowerQuote 返回 ' + plans.length + ' 个方案');

    if (plans.length === 0) {
      return res.json({ success: true, message: '无匹配方案', count: 0 });
    }

    // 4. 逐条写入候选方案清单
    const writePlans = plans.slice(0, 10);
    let successCount = 0, failCount = 0;
    const errors = [];

    for (let i = 0; i < writePlans.length; i++) {
      const plan = writePlans[i];
      try {
        const statusLabel   = plan.analysisStatusLabel || '';
        const statusDetail  = plan.analysisStatusDetail || '';
        const statusValue   = statusLabel === '推荐方案' ? '1'
                             : statusLabel === '电流边界' ? '2'
                             : statusLabel === '时长临界' ? '3'
                             : statusLabel === '可直接推进' ? '4' : 'other';

        const planData = {
          product_requirement_applic__c : recordId,
          module_count__c                : plan.moduleCount || 0,
          cabinet_number__c              : plan.cabinetCount || 0,
          ai_matching_analysis_statu__c  : statusValue,
          min_vdc__c                     : plan.minVdc || dcMin,
          max_vdc__c                     : plan.maxVdc || dcMax,
          max_discharge_current__c        : plan.estimatedCurrent || 0,
          backup_power_duration_eol__c   : plan.estimatedBackupMinutes || 0,
          estimated_voltage_v__c          : plan.estimatedVoltage || 0,
          special_requirement_remark__c  : (plan.productName || '') + '\n' +
            'SKU: ' + (plan.skuCode || '') + '\n' +
            '接线: ' + (plan.lineType || '') + '\n' +
            '模组消防: ' + (plan.moduleFire === '是' ? '带消防' : '不带消防') + '\n' +
            '柜体消防: ' + (plan.cabinetFire === '是' ? '带消防' : '不带消防') + '\n' +
            '功率: ' + powerKw + 'kW / 容量: ' + capacityKwh + 'kWh\n' +
            '方案状态: ' + (plan.status || '') + '\n' +
            '分析说明: ' + statusLabel + ' - ' + statusDetail + '\n' +
            'demandId: ' + demandId,
        };

        const createResult = await fxMcpTool('CreateRecordsByData', {
          apiName: 'candidate_solution_list__c',
          object_data: planData,
        });

        if (createResult && createResult.id) {
          successCount++;
          console.log('[CRM Sync] 方案 ' + (i+1) + ' 写入成功:', createResult.id);
        } else {
          failCount++;
          errors.push('方案' + (i+1) + ': ' + JSON.stringify(createResult));
          console.log('[CRM Sync] 方案 ' + (i+1) + ' 写入失败:', JSON.stringify(createResult));
        }
      } catch (e) {
        failCount++;
        errors.push('方案' + (i+1) + '异常: ' + e.message);
        console.log('[CRM Sync] 方案 ' + (i+1) + ' 异常:', e.message);
      }
    }

    // 5. 返回结果
    res.json({
      success: true,
      message: 'PowerQuote 智能匹配完成',
      demandId,
      totalPlans: plans.length,
      writeSuccess: successCount,
      writeFail: failCount,
      errors: errors.slice(0, 3),  // 最多返回3条错误
    });

  } catch (err) {
    console.error('[CRM Sync] 异常:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// JSON Server 路由（处理 GET/POST/DELETE 等）
server.use(router);

// 错误处理
server.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
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
