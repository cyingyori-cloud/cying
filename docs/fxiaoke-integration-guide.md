# Fxiaoke 集成 PowerQuote 方案

## 集成架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Fxiaoke CRM                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  产品需求申请 (product_requirement_applic__c)        │   │
│  │  - target_power_kw__c      (目标功率)               │   │
│  │  - target_capacity_kwh__c   (目标容量)               │   │
│  │  - backup_power_duration_min__c (备电时长)            │   │
│  │  - dc_min_voltage__c        (DC最低电压)              │   │
│  │  - dc_max_voltage__c        (DC最高电压)              │   │
│  │                                                     │   │
│  │  [🔘 查看方案列表] ← button_view_sku_solution_list__c │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 点击按钮
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Fxiaoke 自定义控制器                          │
│  - 接收 Fxiaoke 字段参数                                    │
│  - 调用 PowerQuote API                                      │
│  - 格式化返回结果                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST
                              │ /api/demand-matching/calculate
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              PowerQuote API (Railway)                       │
│  https://cying-production.up.railway.app                   │
│                                                             │
│  输入:                                                       │
│  - targetPowerKw: 目标功率                                   │
│  - targetEnergyKWh: 目标容量                                 │
│  - backupMinutes: 备电时长                                   │
│  - dcVoltageMin/Max: DC电压范围                              │
│                                                             │
│  输出:                                                       │
│  - matchedSolutions: 匹配方案列表                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                         展示方案列表
```

## Fxiaoke 配置步骤

### 第一步：创建自定义控制器

1. 登录 Fxiaoke 管理后台
2. 进入「定制开放平台」→「自定义控制器」
3. 点击「新建控制器」

**控制器配置：**
| 配置项 | 值 |
|--------|-----|
| 控制器名称 | `powerquote_solution_finder` |
| 控制器描述 | 调用 PowerQuote 获取方案列表 |
| 使用语言 | JavaScript (Node.js) |

### 第二步：编写控制器代码

在代码编辑器中粘贴以下代码：

```javascript
const https = require('https');

const POWERQUOTE_API = 'https://cying-production.up.railway.app/api/demand-matching/calculate';
const API_KEY = 'dev-api-key-12345';

function callPowerQuoteAPI(params) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify(params);
    const url = new URL(POWERQUOTE_API);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });

    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

async function handleRequest(params, context) {
  const { target_power_kw__c, target_capacity_kwh__c, backup_power_duration_min__c,
          dc_min_voltage__c, dc_max_voltage__c } = params;

  const powerQuoteParams = {
    targetPowerKw: parseFloat(target_power_kw__c) || 0,
    targetEnergyKWh: parseFloat(target_capacity_kwh__c) || 0,
    backupMinutes: parseInt(backup_power_duration_min__c) || 0,
    dcVoltageMin: parseFloat(dc_min_voltage__c) || 520,
    dcVoltageMax: parseFloat(dc_max_voltage__c) || 680,
    moduleCounts: [8, 9, 10, 12, 14, 16]
  };

  try {
    const result = await callPowerQuoteAPI(powerQuoteParams);
    return { success: true, solutions: result.matchedSolutions || [], raw: result };
  } catch (error) {
    return { error: true, message: error.message };
  }
}

module.exports = { handleRequest };
```

### 第三步：配置按钮调用控制器

1. 进入「产品需求申请」对象的设计器
2. 找到按钮 `button_view_sku_solution_list__c`
3. 编辑按钮 → 「动作」→ 选择「调用自定义控制器」
4. 选择刚创建的控制器 `powerquote_solution_finder`

### 第四步：配置返回值展示

控制器返回结果后，需要在 Fxiaoke 中展示。可以：

**方案 A：弹窗展示**
- 在按钮配置中选择「弹窗展示」
- 返回 JSON 格式的方案列表

**方案 B：更新字段**
- 把方案 ID 或名称写入某个字段
- 销售点击后可以看到推荐方案

## PowerQuote API 参数映射

| Fxiaoke 字段 | API 参数 | 类型 | 说明 |
|-------------|---------|------|------|
| target_power_kw__c | targetPowerKw | number | 目标功率 (kW) |
| target_capacity_kwh__c | targetEnergyKWh | number | 目标容量 (kWh) |
| backup_power_duration_min__c | backupMinutes | number | 备电时长 (分钟) |
| dc_min_voltage__c | dcVoltageMin | number | DC最低电压 |
| dc_max_voltage__c | dcVoltageMax | number | DC最高电压 |
| module_fire_protection__c | moduleFireProtection | string | 模组消防 |
| cabinet_fire_protection__c | cabinetFireProtection | string | 机柜消防 |
| wiring_method__c | wiringMethod | string | 接线方式 |
| special_requirement_remark__c | remarks | string | 特殊需求备注 |

## 返回值格式

```json
{
  "success": true,
  "solutions": [
    {
      "id": "sku_5000wh_15min",
      "name": "5000Wh-15分钟备电方案",
      "powerKw": 5,
      "energyKWh": 5,
      "backupMinutes": 15,
      "dcVoltage": "600V",
      "price": 15000,
      "modules": 8,
      "matchScore": 95
    }
  ]
}
```

## 常见问题

### Q: 按钮点击没反应？
检查：
1. 按钮是否正确绑定到自定义控制器
2. 控制器代码是否有语法错误
3. Fxiaoke 日志中是否有错误信息

### Q: API 调用失败？
检查：
1. PowerQuote API 是否可访问（https://cying-production.up.railway.app/api/health）
2. API_KEY 是否正确
3. 网络是否能访问外部 HTTPS

### Q: 如何调试？
在自定义控制器中添加 `console.log`，然后在 Fxiaoke 的「日志」中查看输出。
