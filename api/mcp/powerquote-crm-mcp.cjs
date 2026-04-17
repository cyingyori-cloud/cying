const { randomUUID } = require('node:crypto');
const z = require('zod/v4');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { isInitializeRequest } = require('@modelcontextprotocol/sdk/types.js');

const LEGACY_PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = {
  name: 'powerquote-mcp',
  version: '1.2.0',
};
const SDK_VERSION = '1.29.0';
const DISPLAY_FIRE_FILTER_OPTIONS = ['全部', '带消防', '不带消防'];
const DISPLAY_LINE_TYPE_OPTIONS = ['全部', '2线', '3线'];

// 与 InquiryMatching 页面当前的默认候选保持一致，对外部 MCP 不暴露该技术参数。
const DEFAULT_MODULE_COUNTS = [8, 9, 10, 11];
const REFERENCE_ROWS = {
  8: { rackQty: 4, minVdc: 358.4, maxVdc: 441.6, backupEolMin: 8.5 },
  9: { rackQty: 4, minVdc: 403.2, maxVdc: 496.8, backupEolMin: 9.6 },
  10: { rackQty: 4, minVdc: 448.0, maxVdc: 552.0, backupEolMin: 10.6 },
  11: { rackQty: 3, minVdc: 492.8, maxVdc: 607.2, backupEolMin: 8.8 },
  12: { rackQty: 3, minVdc: 537.6, maxVdc: 662.4, backupEolMin: 9.6 },
  14: { rackQty: 4, minVdc: 627.2, maxVdc: 772.8, backupEolMin: 11.2 },
  16: { rackQty: 4, minVdc: 716.8, maxVdc: 883.2, backupEolMin: 12.8 },
};

const TOOLS = [
  {
    name: 'calculate_demand_matching',
    description: '根据客户需求参数计算匹配的方案列表。这是 PowerQuote 智能报价的核心入口。',
    inputSchema: {
      type: 'object',
      properties: {
        targetPowerKw: { type: 'number', description: '目标功率，单位 kW。例如 420' },
        targetEnergyKWh: { type: 'number', description: '目标能量，单位 kWh。例如 60' },
        backupMinutes: { type: 'number', description: '备电时长，单位分钟。例如 120' },
        dcVoltageMin: { type: 'number', description: 'DC 电压下限，单位 V。例如 520' },
        dcVoltageMax: { type: 'number', description: 'DC 电压上限，单位 V。例如 680' },
        moduleFireFilter: {
          type: 'string',
          enum: DISPLAY_FIRE_FILTER_OPTIONS,
          description: '模组消防过滤，可选值：全部、带消防、不带消防。默认 全部',
        },
        cabinetFireFilter: {
          type: 'string',
          enum: DISPLAY_FIRE_FILTER_OPTIONS,
          description: '柜体消防过滤，可选值：全部、带消防、不带消防。默认 全部',
        },
        lineTypeFilter: {
          type: 'string',
          enum: DISPLAY_LINE_TYPE_OPTIONS,
          description: '接线方式过滤，可选值：全部、2线、3线。默认 全部',
        },
      },
      required: ['targetPowerKw', 'targetEnergyKWh', 'backupMinutes'],
    },
  },
  {
    name: 'list_products',
    description: '查询 PowerQuote 产品目录，返回全部产品及规格参数。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_product',
    description: '根据产品 ID 查询单个产品详情。',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: '产品 ID，例如 P001' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'list_demand_records',
    description: '查询历史需求匹配记录。',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回记录数量限制，默认 10' },
      },
    },
  },
  {
    name: 'get_demand_record',
    description: '根据需求记录 ID 查询完整匹配结果。',
    inputSchema: {
      type: 'object',
      properties: {
        demandId: { type: 'string', description: '需求记录 ID，例如 demand_1712345678900' },
      },
      required: ['demandId'],
    },
  },
  {
    name: 'create_quotation',
    description: '基于选定方案创建报价单。',
    inputSchema: {
      type: 'object',
      properties: {
        demandId: { type: 'string', description: '关联的需求记录 ID' },
        planId: { type: 'string', description: '选定方案 ID' },
        customerName: { type: 'string', description: '客户名称' },
        contactPerson: { type: 'string', description: '联系人' },
        contactPhone: { type: 'string', description: '联系电话' },
        notes: { type: 'string', description: '备注说明' },
      },
      required: ['demandId', 'planId', 'customerName'],
    },
  },
  {
    name: 'list_quotations',
    description: '查询报价单列表。',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回记录数量限制，默认 10' },
      },
    },
  },
  {
    name: 'get_quotation',
    description: '根据报价单 ID 查询报价单详情。',
    inputSchema: {
      type: 'object',
      properties: {
        quotationId: { type: 'string', description: '报价单 ID，例如 quote_1712345678900' },
      },
      required: ['quotationId'],
    },
  },
];

function getConfiguredMcpKeys() {
  return [
    process.env.MCP_API_KEY,
    process.env.MCP_API_KEY_1,
    process.env.MCP_API_KEY_2,
  ].filter(Boolean);
}

function hasMcpAuth() {
  return getConfiguredMcpKeys().length > 0;
}

function authorizeMcpRequest(req, res) {
  const keys = getConfiguredMcpKeys();
  if (keys.length === 0) {
    return true;
  }

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const headerToken = req.headers['x-api-key'];
  const token = bearerToken || headerToken;

  if (!token || !keys.includes(token)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid MCP API key',
    });
    return false;
  }

  return true;
}

function setCommonHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, MCP-Session-Id, Last-Event-ID');
}

function buildBaseUrl(req) {
  const forwardedHost = req.get('x-forwarded-host');
  const host = forwardedHost
    ? forwardedHost.split(',')[0].trim()
    : req.get('host');
  return `${req.protocol}://${host}`;
}

function buildInfoPayload(req) {
  const baseUrl = buildBaseUrl(req);
  return {
    ...SERVER_INFO,
    sdkVersion: SDK_VERSION,
    description: 'PowerQuote 智能报价系统的官方 MCP SDK 远程服务',
    recommendedTransport: {
      type: 'streamable-http',
      url: `${baseUrl}/mcp`,
    },
    compatibleAliases: [
      `${baseUrl}/mcp/sse`,
    ],
    manualEndpoints: {
      health: `${baseUrl}/mcp/health`,
      info: `${baseUrl}/mcp/info`,
      tools: `${baseUrl}/mcp/tools`,
    },
    auth: {
      required: hasMcpAuth(),
      acceptedHeaders: ['Authorization: Bearer <token>', 'X-API-Key: <token>'],
    },
  };
}

function createRpcError(message, code = -32000) {
  return {
    jsonrpc: '2.0',
    id: null,
    error: {
      code,
      message,
    },
  };
}

function serializeToolResult(data) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function stripSkuFromPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return plan;
  }

  const { skuCode, ...rest } = plan;
  return rest;
}

function sanitizeMcpPayload(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeMcpPayload(item));
  }

  // 候选方案列表直接返回时，去掉 skuCode
  if ('plans' in data && Array.isArray(data.plans)) {
    return {
      ...data,
      plans: data.plans.map((plan) => stripSkuFromPlan(plan)),
    };
  }

  // 需求记录 / 历史记录里嵌套的 result.plans，也统一去掉 skuCode
  if ('result' in data && data.result && typeof data.result === 'object' && Array.isArray(data.result.plans)) {
    return {
      ...data,
      result: {
        ...data.result,
        plans: data.result.plans.map((plan) => stripSkuFromPlan(plan)),
      },
    };
  }

  return data;
}

function serializeToolError(error, toolName) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          error: true,
          tool: toolName,
          message: error.message,
        }, null, 2),
      },
    ],
    isError: true,
  };
}

function normalizeFireFilterInput(value, fieldName) {
  if (value == null || value === '') {
    return '全部';
  }

  const normalized = String(value).trim();
  const mapping = {
    ALL: '全部',
    YES: '带消防',
    NO: '不带消防',
    全部: '全部',
    带消防: '带消防',
    不带消防: '不带消防',
  };

  if (!mapping[normalized]) {
    throw new Error(`${fieldName} 仅支持：全部、带消防、不带消防`);
  }

  return mapping[normalized];
}

function normalizeLineTypeFilterInput(value, fieldName) {
  if (value == null || value === '') {
    return '全部';
  }

  const normalized = String(value).trim();
  const mapping = {
    ALL: '全部',
    全部: '全部',
    '2线': '2线',
    '3线': '3线',
  };

  if (!mapping[normalized]) {
    throw new Error(`${fieldName} 仅支持：全部、2线、3线`);
  }

  return mapping[normalized];
}

function parseNumber(value, fieldName, { min = -Infinity, max = Infinity } = {}) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${fieldName} 必须是数字`);
  }
  if (value < min || value > max) {
    throw new Error(`${fieldName} 超出允许范围`);
  }
  return value;
}

function normalizeModuleCounts(moduleCounts) {
  if (moduleCounts == null) {
    return DEFAULT_MODULE_COUNTS;
  }
  if (!Array.isArray(moduleCounts) || moduleCounts.length === 0) {
    throw new Error('moduleCounts 必须是至少包含一个元素的数组');
  }
  return moduleCounts.map((count) => {
    if (typeof count !== 'number' || Number.isNaN(count)) {
      throw new Error('moduleCounts 中的值必须是数字');
    }
    return count;
  });
}

function calculateDemandMatching(db, args = {}) {
  const targetPowerKw = parseNumber(args.targetPowerKw, 'targetPowerKw', { min: 1, max: 10000 });
  const targetEnergyKWh = parseNumber(args.targetEnergyKWh, 'targetEnergyKWh', { min: 1, max: 10000 });
  const backupMinutes = parseNumber(args.backupMinutes, 'backupMinutes', { min: 0, max: 1440 });
  const dcVoltageMin = args.dcVoltageMin == null
    ? 520
    : parseNumber(args.dcVoltageMin, 'dcVoltageMin', { min: 0, max: 1000 });
  const dcVoltageMax = args.dcVoltageMax == null
    ? 680
    : parseNumber(args.dcVoltageMax, 'dcVoltageMax', { min: 0, max: 1000 });
  const moduleCounts = normalizeModuleCounts(args.moduleCounts);
  const moduleFireFilter = normalizeFireFilterInput(args.moduleFireFilter, 'moduleFireFilter');
  const cabinetFireFilter = normalizeFireFilterInput(args.cabinetFireFilter, 'cabinetFireFilter');
  const lineTypeFilter = normalizeLineTypeFilterInput(args.lineTypeFilter, 'lineTypeFilter');

  if (dcVoltageMin >= dcVoltageMax) {
    throw new Error('dcVoltageMax 必须大于 dcVoltageMin');
  }

  const products = db.get('products').value() || [];
  const plans = [];
  let planId = Date.now();

  for (const moduleCount of moduleCounts) {
    const ref = REFERENCE_ROWS[moduleCount];
    if (!ref) {
      continue;
    }

    for (const product of products) {
      if (!product.specs) {
        continue;
      }

      for (const lineType of ['2线', '3线']) {
        if (lineTypeFilter !== '全部' && lineTypeFilter !== lineType) {
          continue;
        }

        const moduleFire = product.specs.moduleFire || '否';
        if (moduleFireFilter !== '全部') {
          const fireRequired = moduleFireFilter === '带消防';
          if ((moduleFire === '是') !== fireRequired) {
            continue;
          }
        }

        const cabinetFire = product.specs.cabinetFire || '否';
        if (cabinetFireFilter !== '全部') {
          const fireRequired = cabinetFireFilter === '带消防';
          if ((cabinetFire === '是') !== fireRequired) {
            continue;
          }
        }

        const cabinetCount = ref.rackQty;
        const rackEnergyKWh = moduleCount * 1.86;
        const estimatedEnergyKWh = Math.round(rackEnergyKWh * cabinetCount * 100) / 100;
        const lineVoltageBoost = lineType === '3线' ? 1.0 : 0.92;
        const fireVoltagePenalty = cabinetFire === '是' ? 0.99 : 1;
        const estimatedMinVdc = Math.round(ref.minVdc * lineVoltageBoost * fireVoltagePenalty * 10) / 10;
        const estimatedMaxVdc = Math.round(ref.maxVdc * lineVoltageBoost * fireVoltagePenalty * 10) / 10;
        const estimatedVoltage = estimatedMaxVdc;
        const effectivePowerKw = targetPowerKw * 0.9 * 0.6;
        const estimatedCurrent = Math.round((effectivePowerKw * 1000) / Math.max(estimatedMinVdc, 1) * 100) / 100;
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
          estimatedVoltage: Math.round(estimatedVoltage * 10) / 10,
          estimatedCurrent,
          estimatedBackupMinutes: Math.round(estimatedBackupMinutes * 10) / 10,
          analysisStatusLabel: demoStatus.label,
          analysisStatusDetail: demoStatus.detail,
          status: ['电压超界', '电流超界', '超限需复核'].includes(demoStatus.label)
            ? 'INVALID'
            : ['时长临界', '电流边界', '需补充说明', '续航偏差', '需技术确认'].includes(demoStatus.label)
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
  for (const plan of topPlans) {
    productCounts[plan.productId] = (productCounts[plan.productId] || 0) + 1;
  }
  const winnerId = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const winner = products.find((product) => product.id === winnerId) || products[0] || null;

  const demandRecord = {
    id: `demand_${Date.now()}`,
    createdAt: new Date().toISOString(),
    input: {
      targetPowerKw,
      targetEnergyKWh,
      backupMinutes,
      dcVoltageMin,
      dcVoltageMax,
      moduleCounts,
      moduleFireFilter,
      cabinetFireFilter,
      lineTypeFilter,
    },
    result: {
      plans: plans.slice(0, 10),
      winner: winner ? { id: winner.id, modelName: winner.modelName } : null,
      stats: {
        totalPlans: plans.length,
        validPlans: plans.filter((plan) => plan.status === 'VALID').length,
        warningPlans: plans.filter((plan) => plan.status === 'WARNING').length,
        invalidPlans: plans.filter((plan) => plan.status === 'INVALID').length,
      },
    },
  };

  db.get('demandMatching.records').unshift(demandRecord).write();

  return {
    demandId: demandRecord.id,
    plans: demandRecord.result.plans,
    winner: demandRecord.result.winner,
    stats: demandRecord.result.stats,
  };
}

function listProducts(db) {
  return db.get('products').value() || [];
}

function getProduct(db, args = {}) {
  if (!args.productId) {
    throw new Error('productId 为必填项');
  }
  const product = db.get('products').find({ id: args.productId }).value();
  if (!product) {
    throw new Error(`未找到产品: ${args.productId}`);
  }
  return product;
}

function listDemandRecords(db, args = {}) {
  const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : 10;
  return (db.get('demandMatching.records').value() || []).slice(0, limit);
}

function getDemandRecord(db, args = {}) {
  if (!args.demandId) {
    throw new Error('demandId 为必填项');
  }
  const record = db.get('demandMatching.records').find({ id: args.demandId }).value();
  if (!record) {
    throw new Error(`未找到需求记录: ${args.demandId}`);
  }
  return record;
}

function createQuotation(db, args = {}) {
  if (!args.demandId || !args.planId || !args.customerName) {
    throw new Error('demandId、planId、customerName 为必填项');
  }

  const quotation = {
    id: `quote_${Date.now()}`,
    createdAt: new Date().toISOString(),
    demandId: args.demandId,
    planId: args.planId,
    customerName: args.customerName,
    contactPerson: args.contactPerson || '',
    contactPhone: args.contactPhone || '',
    notes: args.notes || '',
  };

  db.get('quotations.records').unshift(quotation).write();
  return quotation;
}

function listQuotations(db, args = {}) {
  const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : 10;
  return (db.get('quotations.records').value() || []).slice(0, limit);
}

function getQuotation(db, args = {}) {
  if (!args.quotationId) {
    throw new Error('quotationId 为必填项');
  }
  const quotation = db.get('quotations.records').find({ id: args.quotationId }).value();
  if (!quotation) {
    throw new Error(`未找到报价单: ${args.quotationId}`);
  }
  return quotation;
}

function createPowerQuoteMcpServer(db) {
  const mcpServer = new McpServer(SERVER_INFO, {
    capabilities: {
      logging: {},
    },
  });

  mcpServer.registerTool(
    'calculate_demand_matching',
    {
      description: '根据客户需求参数计算匹配的方案列表。这是 PowerQuote 智能报价的核心入口。',
      inputSchema: {
        targetPowerKw: z.number().min(1).max(10000).describe('目标功率，单位 kW。例如 420'),
        targetEnergyKWh: z.number().min(1).max(10000).describe('目标能量，单位 kWh。例如 60'),
        backupMinutes: z.number().min(0).max(1440).describe('备电时长，单位分钟。例如 120'),
        dcVoltageMin: z.number().min(0).max(1000).optional().default(520).describe('DC 电压下限，单位 V。例如 520'),
        dcVoltageMax: z.number().min(0).max(1000).optional().default(680).describe('DC 电压上限，单位 V。例如 680'),
        moduleFireFilter: z.enum(DISPLAY_FIRE_FILTER_OPTIONS).optional().default('全部').describe('模组消防过滤'),
        cabinetFireFilter: z.enum(DISPLAY_FIRE_FILTER_OPTIONS).optional().default('全部').describe('柜体消防过滤'),
        lineTypeFilter: z.enum(DISPLAY_LINE_TYPE_OPTIONS).optional().default('全部').describe('接线方式过滤'),
      },
    },
    async (args) => {
      try {
        return serializeToolResult(sanitizeMcpPayload(calculateDemandMatching(db, args)));
      } catch (error) {
        return serializeToolError(error, 'calculate_demand_matching');
      }
    }
  );

  mcpServer.registerTool(
    'list_products',
    {
      description: '查询 PowerQuote 产品目录，返回全部产品及规格参数。',
    },
    async () => serializeToolResult(listProducts(db))
  );

  mcpServer.registerTool(
    'get_product',
    {
      description: '根据产品 ID 查询单个产品详情。',
      inputSchema: {
        productId: z.string().min(1).describe('产品 ID，例如 P001'),
      },
    },
    async (args) => {
      try {
        return serializeToolResult(getProduct(db, args));
      } catch (error) {
        return serializeToolError(error, 'get_product');
      }
    }
  );

  mcpServer.registerTool(
    'list_demand_records',
    {
      description: '查询历史需求匹配记录。',
      inputSchema: {
        limit: z.number().int().positive().optional().describe('返回记录数量限制，默认 10'),
      },
    },
    async (args) => serializeToolResult(sanitizeMcpPayload(listDemandRecords(db, args)))
  );

  mcpServer.registerTool(
    'get_demand_record',
    {
      description: '根据需求记录 ID 查询完整匹配结果。',
      inputSchema: {
        demandId: z.string().min(1).describe('需求记录 ID，例如 demand_1712345678900'),
      },
    },
    async (args) => {
      try {
        return serializeToolResult(sanitizeMcpPayload(getDemandRecord(db, args)));
      } catch (error) {
        return serializeToolError(error, 'get_demand_record');
      }
    }
  );

  mcpServer.registerTool(
    'create_quotation',
    {
      description: '基于选定方案创建报价单。',
      inputSchema: {
        demandId: z.string().min(1).describe('关联的需求记录 ID'),
        planId: z.string().min(1).describe('选定方案 ID'),
        customerName: z.string().min(1).describe('客户名称'),
        contactPerson: z.string().optional().describe('联系人'),
        contactPhone: z.string().optional().describe('联系电话'),
        notes: z.string().optional().describe('备注说明'),
      },
    },
    async (args) => {
      try {
        return serializeToolResult(createQuotation(db, args));
      } catch (error) {
        return serializeToolError(error, 'create_quotation');
      }
    }
  );

  mcpServer.registerTool(
    'list_quotations',
    {
      description: '查询报价单列表。',
      inputSchema: {
        limit: z.number().int().positive().optional().describe('返回记录数量限制，默认 10'),
      },
    },
    async (args) => serializeToolResult(listQuotations(db, args))
  );

  mcpServer.registerTool(
    'get_quotation',
    {
      description: '根据报价单 ID 查询报价单详情。',
      inputSchema: {
        quotationId: z.string().min(1).describe('报价单 ID，例如 quote_1712345678900'),
      },
    },
    async (args) => {
      try {
        return serializeToolResult(getQuotation(db, args));
      } catch (error) {
        return serializeToolError(error, 'get_quotation');
      }
    }
  );

  return mcpServer;
}

function cleanupSession(sessions, sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry || entry.cleanedUp) {
    return;
  }

  entry.cleanedUp = true;
  sessions.delete(sessionId);
  entry.server.close().catch(() => {});
}

async function handleStreamableRequest(req, res, db, sessions) {
  if (!authorizeMcpRequest(req, res)) {
    return;
  }

  const sessionIdHeader = Array.isArray(req.headers['mcp-session-id'])
    ? req.headers['mcp-session-id'][0]
    : req.headers['mcp-session-id'];

  try {
    let entry = sessionIdHeader ? sessions.get(sessionIdHeader) : undefined;
    let transport;

    if (entry) {
      transport = entry.transport;
    } else if (!sessionIdHeader && req.method === 'POST' && isInitializeRequest(req.body)) {
      const server = createPowerQuoteMcpServer(db);
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          sessions.set(sessionId, { transport, server, cleanedUp: false });
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          cleanupSession(sessions, transport.sessionId);
        }
      };

      transport.onerror = (error) => {
        console.error('[PowerQuote MCP] Streamable transport error:', error);
      };

      await server.connect(transport);
    } else {
      res.status(sessionIdHeader ? 404 : 400).json(
        createRpcError(
          sessionIdHeader
            ? 'Session not found or expired'
            : 'Bad Request: initialize must be sent with POST before using this transport'
        )
      );
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[PowerQuote MCP] Streamable request failed:', error);
    if (!res.headersSent) {
      res.status(500).json(createRpcError('Internal server error', -32603));
    }
  }
}

function registerPowerQuoteCrmMcp(server, { router }) {
  const streamableSessions = new Map();
  const legacySseSessions = new Map();

  server.use('/mcp', (req, res, next) => {
    setCommonHeaders(res);
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  server.get('/mcp/health', (req, res) => {
    if (!authorizeMcpRequest(req, res)) {
      return;
    }

    res.json({
      status: 'ok',
      ...SERVER_INFO,
      sdkVersion: SDK_VERSION,
      transports: ['streamable-http'],
      compatibleAliases: ['/mcp/sse'],
    });
  });

  server.get('/mcp/info', (req, res) => {
    if (!authorizeMcpRequest(req, res)) {
      return;
    }

    res.json(buildInfoPayload(req));
  });

  server.get('/mcp/tools', (req, res) => {
    if (!authorizeMcpRequest(req, res)) {
      return;
    }

    res.json({ tools: TOOLS });
  });

  server.all('/mcp', async (req, res) => {
    await handleStreamableRequest(req, res, router.db, streamableSessions);
  });

  // 兼容纷享销客等仍使用 2024-11-05 官方旧式 SSE transport 的客户端。
  server.get('/mcp/sse', async (req, res) => {
    if (!authorizeMcpRequest(req, res)) {
      return;
    }

    try {
      const legacyServer = createPowerQuoteMcpServer(router.db);
      const transport = new SSEServerTransport('/mcp/messages', res);
      legacySseSessions.set(transport.sessionId, { transport, server: legacyServer, cleanedUp: false });

      res.on('close', () => {
        cleanupSession(legacySseSessions, transport.sessionId);
      });

      await legacyServer.connect(transport);
    } catch (error) {
      console.error('[PowerQuote MCP] Legacy SSE bootstrap failed:', error);
      if (!res.headersSent) {
        res.status(500).json(createRpcError('Legacy SSE bootstrap failed', -32603));
      }
    }
  });

  server.post('/mcp/messages', async (req, res) => {
    if (!authorizeMcpRequest(req, res)) {
      return;
    }

    const sessionId = req.query.sessionId;
    const entry = typeof sessionId === 'string' ? legacySseSessions.get(sessionId) : undefined;

    if (!entry) {
      return res.status(400).json(createRpcError('No transport found for sessionId'));
    }

    try {
      await entry.transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('[PowerQuote MCP] Legacy SSE message handling failed:', error);
      if (!res.headersSent) {
        res.status(500).json(createRpcError('Legacy SSE message handling failed', -32603));
      }
    }
  });
}

module.exports = registerPowerQuoteCrmMcp;
