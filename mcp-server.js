/**
 * PowerQuote MCP Server
 * 
 * 这是一个 MCP (Model Context Protocol) 服务器
 * 用于让 AI 助手（如 Fxiaoke、Cursor、Claude Desktop）调用 PowerQuote API
 * 
 * 启动：node mcp-server.js
 * 
 * MCP 端点：https://cying-production.up.railway.app/mcp
 */

const http = require('http');
const https = require('https');

// PowerQuote API 配置
const API_BASE = 'https://cying-production.up.railway.app/api';
const API_KEY = 'dev-api-key-12345';

// MCP 协议版本
const MCP_VERSION = '2024-11-05';

// MCP Schema 定义
const TOOLS = [
  {
    name: 'calculate_demand_matching',
    description: '根据客户需求参数计算匹配的方案列表。这是智能报价的核心功能。',
    inputSchema: {
      type: 'object',
      properties: {
        targetPowerKw: {
          type: 'number',
          description: '目标功率 (kW)，例如：420'
        },
        targetEnergyKWh: {
          type: 'number',
          description: '目标容量 (kWh)，例如：60'
        },
        backupMinutes: {
          type: 'number',
          description: '备电时长 (分钟)，例如：15'
        },
        dcVoltageMin: {
          type: 'number',
          description: 'DC最低电压，例如：520'
        },
        dcVoltageMax: {
          type: 'number',
          description: 'DC最高电压，例如：680'
        },
        moduleCounts: {
          type: 'array',
          items: { type: 'number' },
          description: '模组数量列表，例如：[8, 9, 10]'
        }
      },
      required: ['targetPowerKw', 'targetEnergyKWh', 'backupMinutes']
    }
  },
  {
    name: 'list_products',
    description: '查询产品目录，返回所有可用的产品列表及其规格参数。',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_product',
    description: '根据产品ID查询单个产品的详细信息。',
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: '产品ID，例如：P001'
        }
      },
      required: ['productId']
    }
  }
];

/**
 * 调用 PowerQuote API
 */
function callAPI(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * 处理 MCP 请求
 */
async function handleMCPRequest(request) {
  const { method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        protocolVersion: MCP_VERSION,
        capabilities: { tools: {} },
        serverInfo: {
          name: 'powerquote-mcp',
          version: '1.0.0'
        }
      };

    case 'tools/list':
      return { tools: TOOLS };

    case 'tools/call':
      const { name, arguments: args } = params;
      
      try {
        let result;
        switch (name) {
          case 'calculate_demand_matching':
            result = await callAPI('/demand-matching/calculate', 'POST', {
              targetPowerKw: args.targetPowerKw,
              targetEnergyKWh: args.targetEnergyKWh,
              backupMinutes: args.backupMinutes,
              dcVoltageMin: args.dcVoltageMin || 520,
              dcVoltageMax: args.dcVoltageMax || 680,
              moduleCounts: args.moduleCounts || [8, 9, 10, 12]
            });
            break;

          case 'list_products':
            result = await callAPI('/products');
            break;

          case 'get_product':
            result = await callAPI(`/products/${args.productId}`);
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

/**
 * HTTP 服务器
 */
const server = http.createServer(async (req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'PowerQuote MCP Server' }));
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'PowerQuote MCP Server',
      version: '1.0.0',
      endpoints: {
        mcp: '/mcp',
        health: '/health'
      },
      tools: TOOLS.map(t => t.name)
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/mcp') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const response = await handleMCPRequest(request);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`PowerQuote MCP Server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
