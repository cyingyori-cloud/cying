/**
 * Fxiaoke 自定义控制器 - 调用 PowerQuote API
 */

// 配置
def apiBase = 'https://cying-production.up.railway.app'
def apiKey = 'dev-api-key-12345'

// 请求参数
def data = [
    "targetPowerKw": target_power_kw__c,
    "targetEnergyKWh": target_capacity_kwh__c,
    "backupMinutes": backup_power_duration_min__c,
    "dcVoltageMin": dc_min_voltage__c ?: 520,
    "dcVoltageMax": dc_max_voltage__c ?: 680,
    "moduleCounts": [8, 9, 10, 12, 14, 16]
]

// 请求头
def headers = [
    "Content-Type": "application/json",
    "Authorization": "Bearer " + apiKey
]

// 发送请求
def url = apiBase + '/api/demand-matching/calculate'
def (Boolean error, HttpResult result, String errorMsg) = Fx.http.post(url, headers, data)

if (error || result.statusCode != 200) {
    return ["success": false, "message": errorMsg ?: "请求失败"]
}

def content = result.content
if (content["error"]) {
    return ["success": false, "message": content["message"]]
}

return [
    "success": true,
    "message": "获取到 " + content["plans"].size() + " 个方案",
    "demandId": content["demandId"],
    "planCount": content["plans"].size()
]
