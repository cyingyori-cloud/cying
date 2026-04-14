/**
 * Fxiaoke MCP Client
 * 连接 Fxiaoke CRM MCP 服务，让 AI 能操作 CRM 数据
 *
 * 使用方式：
 *   node server/mcp/fxiaoke-mcp.cjs
 *
 * 环境变量：
 *   FXIAOKE_MCP_URL   - MCP 服务地址
 *   FXIAOKE_APIKEY    - API Key
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// ============================================================
// 配置
// ============================================================

const MCP_URL = process.env.FXIAOKE_MCP_URL || 'https://open.fxiaoke.com/mcp/831345_sandbox/crm-mcp';
const API_KEY = process.env.FXIAOKE_APIKEY || 'FSUTK_25E0694A75F0E22A03268B45E86D87BA8A05188D09CAAB1002D1478D0C4ABE6D';

// ============================================================
// MCP JSON-RPC 请求
// ============================================================

async function mcpRequest(method, params = {}) {
  const separator = MCP_URL.includes('?') ? '&' : '?';
  const url = `${MCP_URL}${separator}apiKey=${API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP 请求失败: HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`MCP 错误: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data.result || data;
}

// ============================================================
// 解析工具 schema（从 Fxiaoke 返回的嵌套结构中提取）
// ============================================================

function parseInputSchema(tool) {
  // Fxiaoke 的 inputSchema 嵌套在 inputSchema 字段里
  const raw = tool.inputSchema || {};
  // 优先从 properties 里找（有些是直接在 properties 下）
  const props = raw.properties || raw;

  // 简化 properties，只保留关键信息
  const simplified = {};
  for (const [key, val] of Object.entries(props)) {
    simplified[key] = {
      type: val.type || 'string',
      description: val.description || val.title || '',
    };
  }

  // required 也在 raw 里
  const required = raw.required || [];

  return {
    type: 'object',
    properties: simplified,
    required,
  };
}

// ============================================================
// 预定义的工具列表（连接前就能给 AI 看）
// ============================================================

const KNOWN_TOOLS = [
  {
    name: 'GetObjectDescribe',
    description: '获取 CRM 对象的语义描述、字段说明。在查询对象数据之前应先调用此工具了解对象结构。',
    inputSchema: {
      type: 'object',
      properties: {
        object_api_name: {
          type: 'string',
          description: '业务对象 API 名称，如 AccountObj（客户）、product_demand_apply（产品需求申请）等',
        },
      },
      required: ['object_api_name'],
    },
  },
  {
    name: 'QueryObjectData',
    description: '查询 CRM 对象数据列表，返回符合条件的记录。',
    inputSchema: {
      type: 'object',
      properties: {
        object_api_name: {
          type: 'string',
          description: '业务对象 API 名称，如 AccountObj',
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: '要查询的字段名列表，如 ["name", "industry", "phone"]',
        },
        filters: {
          type: 'array',
          description: '过滤条件，格式 [["field", "=", "value"]]',
        },
        order_by: {
          type: 'string',
          description: '排序字段，如 "create_time desc"',
        },
        limit: {
          type: 'number',
          description: '返回记录数量限制，默认 20',
        },
      },
      required: ['object_api_name'],
    },
  },
  {
    name: 'GetDataById',
    description: '根据记录 ID 获取 CRM 对象的单条数据详情。',
    inputSchema: {
      type: 'object',
      properties: {
        object_api_name: {
          type: 'string',
          description: '业务对象 API 名称',
        },
        record_id: {
          type: 'string',
          description: '记录 ID',
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: '要返回的字段列表',
        },
      },
      required: ['object_api_name', 'record_id'],
    },
  },
  {
    name: 'CreateRecordsByData',
    description: '在 CRM 中创建新的业务对象记录。',
    inputSchema: {
      type: 'object',
      properties: {
        apiName: {
          type: 'string',
          description: '业务对象 API 名称',
        },
        object_data: {
          type: 'object',
          description: '要创建的字段数据，格式 {"字段名": "值"}',
        },
      },
      required: ['apiName', 'object_data'],
    },
  },
  {
    name: 'UpdateRecordsByData',
    description: '更新 CRM 中已有的业务对象记录。',
    inputSchema: {
      type: 'object',
      properties: {
        apiName: {
          type: 'string',
          description: '业务对象 API 名称',
        },
        record_id: {
          type: 'string',
          description: '要更新的记录 ID',
        },
        object_data: {
          type: 'object',
          description: '要更新的字段数据',
        },
      },
      required: ['apiName', 'record_id', 'object_data'],
    },
  },
  {
    name: 'DeleteRecordsByData',
    description: '删除 CRM 中的业务对象记录。',
    inputSchema: {
      type: 'object',
      properties: {
        apiName: {
          type: 'string',
          description: '业务对象 API 名称',
        },
        record_id: {
          type: 'string',
          description: '要删除的记录 ID',
        },
      },
      required: ['apiName', 'record_id'],
    },
  },
  {
    name: 'action_objectDataName',
    description: '根据名称查询对象数据 ID。输入客户名/产品名等，返回对应的 CRM 记录 ID。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '要查询的名称（从用户输入中提取）',
        },
        apiNames: {
          type: 'array',
          items: { type: 'string' },
          description: '要查询的对象 API 名称列表，留空则默认查客户/商机/联系人/产品/部门/人员',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'action_baseEaInfo',
    description: '查询企业工商基本信息：企业简介、行业分类、上市信息等。',
    inputSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: '企业名称',
        },
      },
      required: ['companyName'],
    },
  },
  {
    name: 'action_baseEaRun',
    description: '查询企业经营信息：年报资产、业务、竞品、融资历史、主要客户及销售占比。',
    inputSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: '企业名称',
        },
      },
      required: ['companyName'],
    },
  },
  {
    name: 'action_baseEaBid',
    description: '查询企业招投标公告信息。',
    inputSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: '企业名称',
        },
      },
      required: ['companyName'],
    },
  },
];

// ============================================================
// 工具调用处理
// ============================================================

async function handleToolCall(name, args) {
  try {
    const result = await mcpRequest('tools/call', {
      name,
      arguments: args,
    });

    return result;
  } catch (error) {
    return {
      error: true,
      message: error.message,
      hint: '请检查网络连接或 MCP 服务状态',
    };
  }
}

// ============================================================
// MCP Server（Stdio 模式，供 AI 助手调用）
// ============================================================

const server = new Server(
  {
    name: 'fxiaoke-mcp-client',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: KNOWN_TOOLS };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = await handleToolCall(name, args);

  return {
    content: [
      {
        type: 'text',
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      },
    ],
  };
});

// ============================================================
// 启动
// ============================================================

async function main() {
  console.error('[Fxiaoke MCP Client] 启动中...');
  console.error(`[Fxiaoke MCP Client] 目标: ${MCP_URL}`);

  // 验证连通性
  try {
    const test = await mcpRequest('tools/list');
    console.error(`[Fxiaoke MCP Client] ✅ 连接成功，共 ${test.tools?.length || 0} 个工具`);
  } catch (error) {
    console.error(`[Fxiaoke MCP Client] ⚠️ 连接失败: ${error.message}`);
    console.error('[Fxiaoke MCP Client] 将使用内置工具定义继续运行');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
