// 获取当前记录数据
def powerKw = context.data.target_power_kw__c
def capacityKwh = context.data.target_capacity_kwh__c
def backupMin = context.data.backup_power_duration_min__c
def dcMin = context.data.dc_min_voltage__c ?: 520
def dcMax = context.data.dc_max_voltage__c ?: 680

// 校验必填参数
if (!powerKw || !capacityKwh || !backupMin) {
    UIAction alertAction = AlertAction.builder()
        .type("default")
        .text("请填写目标功率、目标容量和备电时长")
        .build()
    return alertAction
}

// 调用 APL 控制器
def requestBody = [
    "powerKw": powerKw,
    "capacityKwh": capacityKwh,
    "backupMin": backupMin,
    "dcMin": dcMin,
    "dcMax": dcMax
]

// 发送请求到 APL
def url = 'https://cying-production.up.railway.app/apl/call-powerquote'
def headers = ["Content-Type": "application/json"]

def (Boolean error, HttpResult result, String errorMsg) = Fx.http.post(url, headers, requestBody)

if (error || result.statusCode != 200) {
    UIAction alertAction = AlertAction.builder()
        .type("default")
        .text("调用失败：" + (errorMsg ?: "网络错误"))
        .build()
    return alertAction
}

// 解析结果
def content = result.content
if (content["code"] != 0) {
    UIAction alertAction = AlertAction.builder()
        .type("default")
        .text("获取方案失败：" + content["message"])
        .build()
    return alertAction
}

def data = content["data"]
def demandId = data["demandId"]
def planCount = data["planCount"]

// 返回成功提示，带跳转链接
def solutionUrl = 'https://cying-production.up.railway.app/#/fxiaoke?demandId=' + demandId

UIAction alertAction = AlertAction.builder()
    .type("default")
    .text("获取到 " + planCount + " 个方案\n\n点击查看详情：" + solutionUrl)
    .build()

return alertAction
