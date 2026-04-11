# PowerQuote MCP Server 集成指南

## 概述

PowerQuote MCP Server 让 AI 助手能够操作智能报价系统，包括：
- 需求匹配计算
- 查询产品目录
- 创建报价单
- 查询历史记录

---

## AI 助手可用工具

| 工具名称 | 功能 | 示例场景 |
|---------|------|---------|
| `calculate_demand_matching` | 根据需求参数计算候选方案 | "帮我算一个420kW、60kWh的方案" |
| `list_products` | 查询产品目录 | "有哪些产品可选？" |
| `get_product` | 查询单个产品详情 | "这个产品的详细规格是什么？" |
| `list_demand_records` | 查询历史需求记录 | "最近有哪些询价记录？" |
| `get_demand_record` | 查询单个需求详情 | "这个需求的完整结果是什么？" |
| `create_quotation` | 创建报价单 | "基于这个方案创建报价单" |
| `list_quotations` | 查询报价单列表 | "有哪些报价单？" |
| `get_quotation` | 查询单个报价单 | "这个报价单的具体内容是什么？" |

---

## 配置方式

### WorkBuddy（已配置）
MCP Server 已注册到 WorkBuddy，AI 助手可以直接使用上述工具。

### 其他 AI 客户端

**Claude Desktop:**
```json
// ~/.config/claude/claude_desktop_config.json
{
  "mcpServers": {
    "powerquote": {
      "command": "node",
      "args": ["/path/to/powerquote-db-schema-C/server/mcp/powerquote-mcp.cjs"],
      "env": {
        "API_BASE_URL": "http://localhost:3001",
        "API_KEY_1": "your-api-key"
      }
    }
  }
}
```

**Cursor:**
在 Settings > MCP 中添加服务器配置。

---

## 使用示例

### 示例 1：计算需求匹配

AI 助手可以直接说：
> "客户需求：功率 420kW，能量 60kWh，备电 2 小时，DC 电压 520-680V，模组数 8-11 个。帮我算一下有哪些方案可选？"

AI 会自动调用 `calculate_demand_matching` 工具，返回候选方案列表。

### 示例 2：创建报价单

> "基于刚才计算的方案，给某某公司创建报价单，联系人张三，电话 13800138000"

AI 会自动调用 `create_quotation` 工具创建报价单。

---

## API 接口（REST）

除了 MCP，PowerQuote 也提供 REST API 接口，供其他业务系统调用：

```
基础URL: http://localhost:3001/api

认证: Authorization: Bearer <API_KEY>

接口列表:
- GET    /api/health           # 健康检查
- GET    /api/products         # 产品目录
- POST   /api/demand-matching/calculate  # 需求匹配计算
- GET    /api/demand-matching  # 需求记录列表
- GET    /api/quotations       # 报价单列表
- POST   /api/quotations       # 创建报价单
```

详细 API 文档: [API.md](./API.md)

---

## 本地开发

```bash
# 启动 API 服务
npm run api

# 启动 MCP 服务
npm run mcp

# 同时启动前端和 API
npm run api:dev

# Docker 部署
npm run docker:build
npm run docker:up
```
