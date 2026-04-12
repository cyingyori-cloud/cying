// 调试按钮代码

def powerKw = context.data.target_power_kw__c
def capacityKwh = context.data.target_capacity_kwh__c
def backupMin = context.data.backup_power_duration_min__c

log.info("开始调用 PowerQuote API")
log.info("powerKw=" + powerKw)
log.info("capacityKwh=" + capacityKwh)
log.info("backupMin=" + backupMin)

// 直接用最简单的请求测试
def url = 'https://cying-production.up.railway.app/api/health'
def headers = ["Content-Type": "application/json"]

log.info("发送请求到: " + url)

def (Boolean error, HttpResult result, String errorMsg) = Fx.http.get(url, headers)

log.info("error=" + error)
log.info("errorMsg=" + errorMsg)
log.info("result=" + result)

if (error) {
    UIAction alertAction = AlertAction.builder()
        .type("default")
        .text("网络错误：" + errorMsg)
        .build()
    return alertAction
}

UIAction alertAction = AlertAction.builder()
    .type("default")
    .text("网络正常！\nstatusCode=" + result.statusCode + "\ncontent=" + Fx.json.toJson(result.content))
    .build()

return alertAction
