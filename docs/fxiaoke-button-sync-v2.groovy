/**
 * 产品需求申请 — 按钮触发代码（极简版 + UIAction 返回）
 *
 * 【按钮配置】
 * - 按钮 API Name: button_sync_powerquote__c
 * - 按钮类型: 执行代码（执行脚本）
 * - 按钮位置: 产品需求申请表单
 */

def currentRecord = context.data
def recordId = currentRecord["_id"]

// 检查记录ID
if (!recordId) {
    return AlertAction.builder()
        .type("default")
        .text("错误：无法获取记录ID")
        .build()
}

// 调用后端 webhook
def apiBase = 'https://cying-production.up.railway.app'
def apiKey  = 'dev-api-key-12345'

def headers = [
    "Content-Type"  : "application/json",
    "Authorization" : "Bearer " + apiKey
]
def body = [recordId: recordId]

try {
    def (Boolean callErr, HttpResult httpResult, String errMsg) = Fx.http.post(
        apiBase + "/api/webhook/fxiaoke-sync",
        headers,
        body
    )

    if (callErr || !httpResult) {
        return AlertAction.builder()
            .type("default")
            .text("PowerQuote 同步失败：" + errMsg)
            .build()
    }

    def statusCode = httpResult.statusCode
    if (statusCode == 200) {
        return AlertAction.builder()
            .type("default")
            .text("✅ PowerQuote 同步已触发\n\n请在候选方案清单查看结果")
            .build()
    } else {
        return AlertAction.builder()
            .type("default")
            .text("同步请求已发送，状态码：" + statusCode)
            .build()
    }

} catch (Exception e) {
    return AlertAction.builder()
        .type("default")
        .text("异常：" + e.getMessage())
        .build()
}
