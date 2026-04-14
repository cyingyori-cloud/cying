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
 * 3. webhook 异步完成：读CRM → 算PowerQuote → 写CRM候选方案
 * 4. 用户手动刷新页面查看结果
 */

def currentRecord = context.data
def recordId = currentRecord["_id"]

if (!recordId) {
    log.info("[PowerQuote] 错误：无法获取记录ID")
    return
}

log.info("[PowerQuote] 触发同步，记录ID: " + recordId)

// 调用后端 webhook（结果由 webhook 异步写入 CRM）
def apiBase = 'https://cying-production.up.railway.app'
def apiKey  = 'dev-api-key-12345'

def headers = [
    "Content-Type"  : "application/json",
    "Authorization" : "Bearer " + apiKey
]
def body = [recordId: recordId]

log.info("[PowerQuote] 调用 webhook: " + apiBase + "/api/fxiaoke/sync")

// webhook 在 Railway 后端完成所有处理：
//   1. GetDataById → 读取 CRM 产品需求申请记录
//   2. /api/demand-matching/calculate → PowerQuote 计算
//   3. CreateRecordsByData × N → 写入候选方案清单

try {
    def (Boolean callErr, HttpResult httpResult, String errMsg) = Fx.http.post(
        apiBase + "/api/fxiaoke/sync",
        headers,
        body
    )

    if (callErr || !httpResult) {
        log.info("[PowerQuote] webhook 调用失败: " + errMsg)
        return
    }

    def statusCode = httpResult.statusCode
    def content = httpResult.content ?: ""

    log.info("[PowerQuote] webhook 返回: status=" + statusCode + " content=" + content)

} catch (Exception e) {
    log.info("[PowerQuote] 异常: " + e.getMessage())
}
