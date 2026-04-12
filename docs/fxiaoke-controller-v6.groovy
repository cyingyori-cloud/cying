/**
 * Fxiaoke 自定义控制器 - 调用 PowerQuote API
 */

// 配置
def apiBase = 'https://cying-production.up.railway.app'
def apiKey = 'dev-api-key-12345'

// 构建请求体
def requestBody = [
    "targetPowerKw": target_power_kw__c,
    "targetEnergyKWh": target_capacity_kwh__c,
    "backupMinutes": backup_power_duration_min__c,
    "dcVoltageMin": dc_min_voltage__c ?: 520,
    "dcVoltageMax": dc_max_voltage__c ?: 680,
    "moduleCounts": [8, 9, 10, 12, 14, 16]
]

// 发送请求
def url = apiBase + '/api/demand-matching/calculate'
def headers = ["Content-Type": "application/json", "Authorization": "Bearer " + apiKey]
def body = Fx.json.toJson(requestBody)

def (Boolean error, HttpResult result, String msg) = http.post(url, body, headers)

if (error) {
    return ["success": false, "message": msg]
}

def content = result.content
if (content["error"]) {
    return ["success": false, "message": content["message"]]
}

return [
    "success": true,
    "message": "获取成功",
    "demandId": content["demandId"],
    "planCount": content["plans"].size()
]
