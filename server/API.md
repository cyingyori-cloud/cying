# PowerQuote API 接口文档

## 基础信息

- **Base URL**: `http://localhost:3001/api`
- **数据格式**: JSON
- **认证**: 当前版本暂未实现（后续添加）

---

## 产品目录

### 获取产品列表
```
GET /api/products
```

**响应示例**:
```json
{
  "products": [
    {
      "id": "P001",
      "modelCode": "PAI-200-3AIDC",
      "modelName": "PAI-200kW AIDC 模块化 UPS",
      "classification": "AIDC",
      "ratedPowerKw": 200,
      "ratedEnergyKWh": 200,
      "basePrice": 280000,
      "baseCost": 230000,
      "parallelCapability": "支持并联",
      "warrantyYears": 3,
      "certifications": ["UL9540A", "IEC62619"],
      "status": "active"
    }
  ]
}
```

### 获取产品详情
```
GET /api/products/:id
```

---

## 需求匹配

### 创建需求记录
```
POST /api/demand-matching
```

**请求体**:
```json
{
  "projectName": "AIDC 机房 15 分钟备电",
  "scenario": "AIDC",
  "targetPowerKw": 420,
  "targetEnergyKWh": 60,
  "backupMinutes": 15,
  "dcVoltageMin": 520,
  "dcVoltageMax": 680,
  "topology": "模块化 UPS",
  "specialRequirements": "",
  "moduleCounts": [8, 9, 10, 11],
  "moduleFireFilter": "ALL",
  "cabinetFireFilter": "ALL",
  "lineTypeFilter": "ALL"
}
```

### 方案计算（核心接口）
```
POST /api/demand-matching/calculate
```

**请求体**: 同上

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "PLAN-001",
      "skuCode": "PAI-200-3AIDC-M8-MN-CN-2L",
      "moduleCount": 8,
      "moduleFire": false,
      "cabinetFire": false,
      "lineType": "2线",
      "cabinetCount": 1,
      "estimatedVoltage": 396.8,
      "estimatedMinVoltage": 352.0,
      "estimatedCurrent": 540.54,
      "estimatedEnergyKWh": 14.88,
      "status": "VALID",
      "analysisStatusLabel": "可直接推进",
      "analysisStatusDetail": "电压、电流与时长均处于建议边界内。",
      "analysisSummary": "方案可直接推进。",
      "warnings": [],
      "rankScore": 110,
      "estimatedCost": 18432,
      "recommended": true,
      "pricingTiers": {
        "level1": 22118,
        "level2": 21197,
        "level3": 20275
      }
    }
  ],
  "message": "方案计算完成"
}
```

---

## 候选方案

### 获取需求对应的候选方案
```
GET /api/candidate-plans/:demandId
```

---

## 报价单

### 创建报价单
```
POST /api/quotations
```

**请求体**:
```json
{
  "customerName": "某公司",
  "projectName": "项目名称",
  "plans": ["PLAN-001", "PLAN-002"]
}
```

### 更新报价单
```
PUT /api/quotations/:id
```

### 删除报价单
```
DELETE /api/quotations/:id
```

---

## 状态码说明

| status | 说明 | 标签 |
|--------|------|------|
| VALID | 方案可行 | 🟢 可直接推进 |
| WARNING | 需要确认 | 🟠 需技术确认 |
| INVALID | 超限不可用 | 🔴 超限需复核 |

---

## 后续扩展接口

- [ ] `POST /api/auth/login` - 用户登录
- [ ] `POST /api/quotations/:id/submit` - 提交报价单审批
- [ ] `GET /api/quotations/:id/pdf` - 导出 PDF
- [ ] `POST /api/ai/analyze` - AI 方案分析
