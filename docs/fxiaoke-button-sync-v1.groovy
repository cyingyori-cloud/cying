/**
 * 产品需求申请 — 触发 PowerQuote 同步
 *
 * 【按钮配置】
 * - 按钮 API Name: button_view_sku_plan_list__c
 * - 按钮类型: 执行代码
 * - 位置: 产品需求申请表单
 */

// 获取当前记录
def record = context.data
def recordId = record["_id"]

// 防重复：已处于待同步/同步中状态则跳过
def currentStatus = record["sync_status__c"]
if ("待同步" == currentStatus || "同步中" == currentStatus) {
    log.info("[PowerQuote] recordId=" + recordId + " 状态已是「" + currentStatus + "」，跳过重复提交")
    return
}

// 参数校验
def powerKw     = record["target_power_kw__c"]
def capacityKwh = record["target_capacity_kwh__c"]
def backupMin  = record["backup_power_duration_min__c"]

if (!powerKw || !capacityKwh || !backupMin) {
    log.info("[PowerQuote] 参数不完整，recordId=" + recordId)
    return
}

// 更新状态为"待同步"
def updateResult = Fx.data.update(
    "product_requirement_applic__c",
    [
        _id            : recordId,
        sync_status__c : "待同步"
    ]
)

log.info("[PowerQuote] recordId=" + recordId + " 已提交，自动化将在下一小时执行")
