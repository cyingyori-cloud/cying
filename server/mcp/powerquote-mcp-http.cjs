/**
 * PowerQuote MCP Server - HTTP 模式
 * 让 Fxiaoke CRM 等外部系统能通过 HTTP 接入 PowerQuote
 *
 * 部署到 Railway 后，Fxiaoke 可以在「MCP服务」中配置：
 * - URL: https://cying-production.up.railway.app/mcp
 * - 无需认证（或添加简单 API Key）
 */

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// API 配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const API_KEY = process.env.API_KEY_1 || 'dev-api-key';

// HTTP 请求封装
async function apiRequest(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'API request failed');
  }
  return data;
}

// ============================================================
// MCP 工具定义
// ============================================================

const tools = [
  {
    name: 'calculate_demand_matching',
    description: '根据客户需求参数，计算匹配的候选方案列表。这是智能报价的核心入口。输入功率(kW)、能量(kWh)、备电时长、DC电压范围等参数，返回最优的方案推荐。',
    inputSchema: {
      type: 'object',
      properties: {
        targetPowerKw: { type: 'number', description: '目标功率，单位 kW。例如：420' },
        targetEnergyKWh: { type: 'number', description: '目标能量，单位 kWh。例如：60' },
        backupMinutes: { type: 'number', description: '备电时长，单位分钟。例如：120' },
        dcVoltageMin: { type: 'number', description: 'DC电压下限，单位 V。例如：520' },
        dcVoltageMax: { type: 'number', description: 'DC电压上限，单位 V。例如：680' },
        moduleCounts: { type: 'array', items: { type: 'number' }, description: '考虑的模组数量数组。例如：[8, 9, 10, 11]' },
        moduleFireFilter: { type: 'string', enum: ['ALL', 'YES', 'NO'], description: '模组消防过滤，默认 ALL' },
        cabinetFireFilter: { type: 'string', enum: ['ALL', 'YES', 'NO'], description: '柜体消防过滤，默认 ALL' },
        lineTypeFilter: { type: 'string', enum: ['ALL', '2线', '3线'], description: '线路类型过滤，默认 ALL' },
      },
      required: ['targetPowerKw', 'targetEnergyKWh', 'backupMinutes', 'dcVoltageMin', 'dcVoltageMax', 'moduleCounts'],
    },
  },
  {
    name: 'list_products',
    description: '查询产品目录，返回所有可用的产品列表及其规格参数。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_product',
    description: '根据产品ID查询单个产品的详细信息。',
    inputSchema: {
      type: 'object',
      properties: { productId: { type: 'string', description: '产品ID。例如：product_001' } },
      required: ['productId'],
    },
  },
  {
    name: 'list_demand_records',
    description: '查询历史需求匹配记录，包括客户参数和推荐的方案。',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: '返回记录数量限制，默认 10' } },
    },
  },
  {
    name: 'get_demand_record',
    description: '根据需求ID查询详细的需求记录和计算结果。',
    inputSchema: {
      type: 'object',
      properties: { demandId: { type: 'string', description: '需求记录ID。例如：demand_1712345678900' } },
      required: ['demandId'],
    },
  },
  {
    name: 'create_quotation',
    description: '基于选定的方案创建报价单。',
    inputSchema: {
      type: 'object',
      properties: {
        demandId: { type: 'string', description: '关联的需求记录ID' },
        planId: { type: 'string', description: '选定的方案ID' },
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
    description: '查询所有报价单记录。',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: '返回记录数量限制，默认 10' } },
    },
  },
  {
    name: 'get_quotation',
    description: '根据报价单ID查询详细信息。',
    inputSchema: {
      type: 'object',
      properties: { quotationId: { type: 'string', description: '报价单ID。例如：quote_1712345678900' } },
      required: ['quotationId'],
    },
  },
];

// ============================================================
// 工具执行逻辑
// ============================================================

async function handleToolCall(name, args) {
  try {
    switch (name) {
      case 'calculate_demand_matching':
        return await apiRequest('POST', '/api/demand-matching/calculate', args);
      case 'list_products':
        return await apiRequest('GET', '/api/products');
      case 'get_product':
        return await apiRequest('GET', `/api/products/${args.productId}`);
      case 'list_demand_records':
        const records = await apiRequest('GET', '/api/demand-matching');
        return Array.isArray(records) ? records.slice(0, args.limit || 10) : [];
      case 'get_demand_record':
        return await apiRequest('GET', `/api/demand-matching/${args.demandId}`);
      case 'create_quotation':
        return await apiRequest('POST', '/api/quotations', args);
      case 'list_quotations':
        const quotes = await apiRequest('GET', '/api/quotations');
        return Array.isArray(quotes) ? quotes.slice(0, args.limit || 10) : [];
      case 'get_quotation':
        return await apiRequest('GET', `/api/quotations/${args.quotationId}`);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return { error: true, message: error.message, hint: '请检查参数是否正确，或联系管理员' };
  }
}

// ============================================================
// MCP HTTP 路由
// ============================================================

// 健康检查
app.get('/mcp/health', (req, res) => {
  res.json({ status: 'ok', service: 'powerquote-mcp', version: '1.0.0' });
});

// MCP Discovery Endpoint
app.get('/mcp', (req, res) => {
  res.json({
    name: 'powerquote-mcp',
    version: '1.0.0',
    description: 'PowerQuote 智能报价系统 MCP 服务',
    tools: tools.map(t => ({ name: t.name, description: t.description })),
    endpoints: {
      tools: '/mcp/tools',
      call: '/mcp/call',
    },
  });
});

// 获取工具列表
app.get('/mcp/tools', (req, res) => {
  res.json({ tools });
});

// 调用工具（JSON-RPC 2.0 格式）
app.post('/mcp/call', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;

  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id || null,
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be 2.0' },
    });
  }

  if (method !== 'tools/call') {
    return res.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }

  const { name, arguments: args } = params || {};

  if (!name) {
    return res.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32602, message: 'Invalid params: missing tool name' },
    });
  }

  console.log(`[MCP] 调用工具: ${name}`, args);
  const result = await handleToolCall(name, args);

  res.json({
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    },
  });
});

// 简化版工具调用（非 JSON-RPC，直接 POST /mcp/tools/{toolName}）
app.post('/mcp/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;

  console.log(`[MCP] 调用工具: ${toolName}`, args);
  const result = await handleToolCall(toolName, args);

  res.json(result);
});

// ============================================================
// 启动服务
// ============================================================

const PORT = process.env.MCP_PORT || 3002;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║       PowerQuote MCP Server (HTTP Mode)               ║
║       智能报价系统 MCP 服务                            ║
╠═══════════════════════════════════════════════════════╣
║  Port:     ${PORT}                                      ║
║  Health:   http://localhost:${PORT}/mcp/health           ║
║  Tools:    http://localhost:${PORT}/mcp/tools            ║
║  Call:     POST http://localhost:${PORT}/mcp/call        ║
╚═══════════════════════════════════════════════════════╝
  `);
});
