// URL 跳转方式 - 浏览器端发起请求

def powerKw = context.data.target_power_kw__c
def capacityKwh = context.data.target_capacity_kwh__c
def backupMin = context.data.backup_power_duration_min__c
def dcMin = context.data.dc_min_voltage__c ?: 520
def dcMax = context.data.dc_max_voltage__c ?: 680

// 构建 URL（参数拼接在 hash 后面）
def url = 'https://cying-production.up.railway.app/#/fxiaoke' +
    '?power_kw=' + powerKw +
    '&capacity_kwh=' + capacityKwh +
    '&backup_min=' + backupMin +
    '&dc_min=' + dcMin +
    '&dc_max=' + dcMax

log.info("跳转URL: " + url)

// 打开新窗口
UIAction webAction = new UIAction()
webAction.actionType = "redirect"
webAction.target = "_blank"
webAction.params = ["url": url]

return webAction
