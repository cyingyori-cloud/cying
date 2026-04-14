/**
 * 产品需求申请 — 按钮触发代码（极简版）
 *
 * 【按钮配置】
 * - 按钮 API Name: button_sync_powerquote__c
 * - 按钮类型: 执行代码（执行脚本）
 * - 按钮位置: 产品需求申请表单
 *
 * 【触发流程】
 * 1. 读取当前记录的 recordId
 * 2. 调用后端 webhook（/api/fxiaoke/sync）
 * 3. webhook 完成：读CRM → 算PowerQuote → 写CRM候选方案
 * 4. 弹窗展示结果
 */

def currentRecord = context.data
def recordId = currentRecord["_id"]

if (!recordId) {
    Fx.act.action.AlertAction.fire(
        title: "错误",
        content: "无法获取当前记录ID，请刷新页面后重试。"
    )
    return
}

log.info("[PowerQuote] 触发同步，记录ID: " + recordId)

// 调用后端 webhook
def apiBase = 'https://cying-production.up.railway.app'
def apiKey  = 'dev-api-key-12345'

try {
    def (Boolean callErr, HttpResult result, String errMsg) = Fx.http.post(
        apiBase + "/api/fxiaoke/sync",
        [
            "Content-Type"  : "application/json",
            "Authorization" : "Bearer " + apiKey
        ],
        [
            recordId: recordId
        ]
    )

    if (callErr || !result || result.statusCode != 200) {
        def errContent = result?.content ?: errMsg ?: "未知错误"
        log.info("[PowerQuote] webhook 调用失败: " + errContent)
        Fx.act.action.AlertAction.fire(
            title: "同步失败",
            content: "调用后端服务失败:\n" + errContent
        )
        return
    }

    def respData = Fx.json.parse(result.content)
    def message = respData.message ?: "处理完成"
    def count = respData.totalPlans ?: 0
    def success = respData.writeSuccess ?: 0
    def fail = respData.writeFail ?: 0

    Fx.act.action.AlertAction.fire(
        title: "PowerQuote 智能匹配",
        content: "✅ " + message + "\n\n" +
            "匹配方案: " + count + " 个\n" +
            "写入CRM: " + success + " 个" +
            (fail > 0 ? " ⚠️ 失败: " + fail + " 个" : "") + "\n\n" +
            (respData.errors?.size() > 0 ? "错误: " + respData.errors.join("\n") : "")
    )

    Fx.act.form.reload()

} catch (Exception e) {
    log.info("[PowerQuote] 异常: " + e.getMessage())
    Fx.act.action.AlertAction.fire(
        title: "同步异常",
        content: "发生错误: " + e.getMessage()
    )
}
