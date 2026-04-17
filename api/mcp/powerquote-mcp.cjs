/**
 * PowerQuote MCP Server
 * 智能报价系统 MCP 服务 - 让 AI 助手能操作报价系统
 *
 * 功能：
 * - 需求匹配计算
 * - 查询产品目录
 * - 创建报价单
 * - 查询历史记录
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

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
  // 1. 需求匹配计算
  {
    name: 'calculate_demand_matching',
    description: '根据客户需求参数，计算匹配的候选方案列表。这是智能报价的核心入口。输入功率(kW)、能量(kWh)、备电时长、DC电压范围等参数，返回最优的方案推荐。',
    inputSchema: {
      type: 'object',
      properties: {
        targetPowerKw: {
          type: 'number',
          description: '目标功率，单位 kW。例如：420',
        },
        targetEnergyKWh: {
          type: 'number',
          description: '目标能量，单位 kWh。例如：60',
        },
        backupMinutes: {
          type: 'number',
          description: '备电时长，单位分钟。例如：120',
        },
        dcVoltageMin: {
          type: 'number',
          description: 'DC电压下限，单位 V。例如：520',
        },
        dcVoltageMax: {
          type: 'number',
          description: 'DC电压上限，单位 V。例如：680',
        },
        moduleFireFilter: {
          type: 'string',
          enum: ['全部', '带消防', '不带消防'],
          description: '模组消防过滤，可选值：全部、带消防、不带消防。默认 全部',
        },
        cabinetFireFilter: {
          type: 'string',
          enum: ['全部', '带消防', '不带消防'],
          description: '柜体消防过滤，可选值：全部、带消防、不带消防。默认 全部',
        },
        lineTypeFilter: {
          type: 'string',
          enum: ['全部', '2线', '3线'],
          description: '线路类型过滤，可选值：全部、2线、3线。默认 全部',
        },
      },
      required: ['targetPowerKw', 'targetEnergyKWh', 'backupMinutes', 'dcVoltageMin', 'dcVoltageMax'],
    },
  },

  // 2. 查询产品目录
  {
    name: 'list_products',
    description: '查询产品目录，返回所有可用的产品列表及其规格参数。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // 3. 查询单个产品
  {
    name: 'get_product',
    description: '根据产品ID查询单个产品的详细信息。',
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: '产品ID。例如：product_001',
        },
      },
      required: ['productId'],
    },
  },

  // 4. 查询历史需求记录
  {
    name: 'list_demand_records',
    description: '查询历史需求匹配记录，包括客户参数和推荐的方案。',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '返回记录数量限制，默认 10',
        },
      },
    },
  },

  // 5. 查询单个需求详情
  {
    name: 'get_demand_record',
    description: '根据需求ID查询详细的需求记录和计算结果。',
    inputSchema: {
      type: 'object',
      properties: {
        demandId: {
          type: 'string',
          description: '需求记录ID。例如：demand_1712345678900',
        },
      },
      required: ['demandId'],
    },
  },

  // 6. 创建报价单
  {
    name: 'create_quotation',
    description: '基于选定的方案创建报价单。',
    inputSchema: {
      type: 'object',
      properties: {
        demandId: {
          type: 'string',
          description: '关联的需求记录ID',
        },
        planId: {
          type: 'string',
          description: '选定的方案ID',
        },
        customerName: {
          type: 'string',
          description: '客户名称',
        },
        contactPerson: {
          type: 'string',
          description: '联系人',
        },
        contactPhone: {
          type: 'string',
          description: '联系电话',
        },
        notes: {
          type: 'string',
          description: '备注说明',
        },
      },
      required: ['demandId', 'planId', 'customerName'],
    },
  },

  // 7. 查询报价单列表
  {
    name: 'list_quotations',
    description: '查询所有报价单记录。',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '返回记录数量限制，默认 10',
        },
      },
    },
  },

  // 8. 查询单个报价单
  {
    name: 'get_quotation',
    description: '根据报价单ID查询详细信息。',
    inputSchema: {
      type: 'object',
      properties: {
        quotationId: {
          type: 'string',
          description: '报价单ID。例如：quote_1712345678900',
        },
      },
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
    return {
      error: true,
      message: error.message,
      hint: '请检查参数是否正确，或联系管理员',
    };
  }
}

// ============================================================
// MCP Server 初始化
// ============================================================

const server = new Server(
  {
    name: 'powerquote-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = await handleToolCall(name, args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
});

// ============================================================
// 启动服务器
// ============================================================

async function main() {
  console.error('[PowerQuote MCP Server] 启动中...');

  // 先测试 API 连通性
  try {
    const health = await apiRequest('GET', '/api/health');
    console.error(`[PowerQuote MCP Server] API 连接成功 (${API_BASE_URL})`);
  } catch (error) {
    console.error(`[PowerQuote MCP Server] 警告: 无法连接到 API (${API_BASE_URL})`);
    console.error(`[PowerQuote MCP Server] 错误: ${error.message}`);
    console.error('[PowerQuote MCP Server] MCP Server 将继续启动，但工具调用可能会失败');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[PowerQuote MCP Server] 已启动，等待 AI 助手调用...');
}

main().catch(console.error);
