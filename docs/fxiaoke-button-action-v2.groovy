/**
 * 产品需求申请 — 按钮触发代码（最终版）
 *
 * 【按钮配置】
 * - 按钮 API Name: button_sync_powerquote__c
 * - 按钮类型: 执行代码（执行脚本）
 * - 按钮位置: 产品需求申请表单
 *
 * 【触发流程】
 * 1. 读取当前产品需求申请记录的关键字段
 * 2. 调用 PowerQuote 外部计算接口
 * 3. 解析所有有效方案，逐条写入「候选方案清单」(candidate_solution_list__c)
 * 4. 弹窗展示匹配结果摘要
 *
 * 【字段对应关系】
 * - target_power_kw__c          → 目标功率 (kW)
 * - target_capacity_kwh__c      → 目标容量 (kWh)
 * - backup_power_duration_min__c → 备电时长 (min)
 * - dc_min_voltage__c           → DC 最低电压（可空，默认520）
 * - dc_max_voltage__c           → DC 最高电压（可空，默认680）
 * - scene__c                    → 场景
 * - project_name__c             → 商机项目 ID
 */

// ============================================================
// 第一步：获取当前记录数据
// ============================================================
def currentRecord = context.data
log.info("[PowerQuote] 当前记录: " + Fx.json.toJson(currentRecord))

// ---------- 提取字段值 ----------
def recordId    = currentRecord["_id"]
def powerKw     = currentRecord["target_power_kw__c"]       // 目标功率 kW
def capacityKwh = currentRecord["target_capacity_kwh__c"]  // 目标容量 kWh
def backupMin   = currentRecord["backup_power_duration_min__c"] // 备电时长 min
def dcMin       = currentRecord["dc_min_voltage__c"] ?: 520
def dcMax       = currentRecord["dc_max_voltage__c"] ?: 680
def sceneLabel  = currentRecord["scene__c__r"] ?: currentRecord["scene__c"] ?: "未填"
def oppName     = currentRecord["project_name__c__r"] ?: "未知商机"

// ---------- CRM 选项字段映射 ----------
// wiring_method__c:    "1" = 2线, "2" = 3线
// module_fire_protection__c:  "1" = 带消防, "2" = 不带消防
// cabinet_fire_protection__c: "1" = 带消防, "2" = 不带消防
def wiringVal   = currentRecord["wiring_method__c"]           ?: "ALL"
def moduleFireVal = currentRecord["module_fire_protection__c"] ?: "ALL"
def cabinetFireVal= currentRecord["cabinet_fire_protection__c"]?: "ALL"

def wiringApi = (wiringVal == "1") ? "2线" : (wiringVal == "2") ? "3线" : "ALL"
def moduleFireApi = (moduleFireVal == "1") ? "是" : (moduleFireVal == "2") ? "否" : "ALL"
def cabinetFireApi = (cabinetFireVal == "1") ? "是" : (cabinetFireVal == "2") ? "否" : "ALL"

log.info("[PowerQuote] 消防配置 → 接线: ${wiringVal}(${wiringApi}) 模组: ${moduleFireVal}(${moduleFireApi}) 机柜: ${cabinetFireVal}(${cabinetFireApi})")

// ---------- 参数校验 ----------
if (!powerKw || !capacityKwh || !backupMin) {
    Fx.act.action.AlertAction.fire(
        title: "参数不完整",
        content: "目标功率、容量和备电时长为必填项，请先填写完整后再试。"
    )
    return
}

log.info("[PowerQuote] 提交参数: 功率=${powerKw}kW 容量=${capacityKwh}kWh 备电=${backupMin}min DC=${dcMin}-${dcMax}V")

// ============================================================
// 第二步：调用 PowerQuote 计算接口
// ============================================================
def apiBase = 'https://cying-production.up.railway.app'
def apiKey  = 'dev-api-key-12345'  // TODO: 替换为真实 API Key

def reqBody = [
    targetPowerKw    : powerKw,
    targetEnergyKWh  : capacityKwh,
    backupMinutes    : backupMin,
    dcVoltageMin     : dcMin,
    dcVoltageMax     : dcMax,
    moduleCounts     : [8, 9, 10, 11, 12, 14, 16],
    moduleFireFilter : moduleFireApi,
    cabinetFireFilter: cabinetFireApi,
    lineTypeFilter   : wiringApi
]

def headers = [
    "Content-Type" : "application/json",
    "Authorization": "Bearer " + apiKey
]

def httpResult = null
try {
    def (Boolean callErr, HttpResult result, String errMsg) = Fx.http.post(
        apiBase + "/api/demand-matching/calculate",
        headers,
        reqBody
    )
    httpResult = result
    log.info("[PowerQuote] HTTP 调用完成: success=${!callErr}, status=${result?.statusCode}")

} catch (Exception e) {
    log.info("[PowerQuote] HTTP 异常: " + e.getMessage())
    Fx.act.action.AlertAction.fire(
        title: "连接失败",
        content: "无法连接 PowerQuote 计算服务，请确保服务已部署且外网可访问。\n\n错误: " + e.getMessage()
    )
    return
}

if (!httpResult || httpResult.statusCode != 200) {
    def errMsg = httpResult?.content ?: "未知错误"
    log.info("[PowerQuote] API 返回异常: " + errMsg)
    Fx.act.action.AlertAction.fire(
        title: "计算失败",
        content: "PowerQuote 返回错误:\n" + errMsg
    )
    return
}

// ============================================================
// 第三步：解析计算结果
// ============================================================
def apiData = Fx.json.parse(httpResult.content)
def plans = apiData["plans"] ?: []
def demandId = apiData["demandId"] ?: ""

log.info("[PowerQuote] 匹配到 ${plans.size()} 个方案，demandId: " + demandId)

if (plans.size() == 0) {
    Fx.act.action.AlertAction.fire(
        title: "无匹配方案",
        content: "未找到符合以下条件的方案:\n功率 ${powerKw}kW / 容量 ${capacityKwh}kWh / 备电 ${backupMin}min\n\n请调整参数后重试。"
    )
    return
}

// 取前 10 个方案写入（避免单次写入过多）
def writePlans = plans.take(10)

// ============================================================
// 第四步：写入「候选方案清单」(candidate_solution_list__c)
// ============================================================
def successCount = 0
def failCount = 0

writePlans.eachWithIndex { plan, index ->
    try {
        // 解析方案字段
        def moduleCount   = plan["moduleCount"]      ?: 0
        def cabinetNum    = plan["cabinetCount"]    ?: 0
        def estVoltage    = plan["estimatedVoltage"] ?: 0
        def minVdc        = plan["minVdc"]          ?: dcMin
        def maxVdc        = plan["maxVdc"]          ?: dcMax
        def maxCurr       = plan["estimatedCurrent"] ?: 0
        def backupEol     = plan["estimatedBackupMinutes"] ?: 0
        def lineType      = plan["lineType"]         ?: ""
        def moduleFire    = plan["moduleFire"]       ?: "否"
        def cabinetFire   = plan["cabinetFire"]     ?: "否"
        def skuCode       = plan["skuCode"]          ?: ""
        def planStatus    = plan["status"]           ?: ""
        def statusLabel   = plan["analysisStatusLabel"] ?: ""
        def statusDetail  = plan["analysisStatusDetail"] ?: ""
        def productName   = plan["productName"]      ?: ""

        // 分析状态：文案 → 下拉选项值
        def statusValue   = "other"
        if (statusLabel == "推荐方案") {
            statusValue = "1"
        } else if (statusLabel == "电流边界") {
            statusValue = "2"
        } else if (statusLabel == "时长临界") {
            statusValue = "3"
        } else if (statusLabel == "可直接推进") {
            statusValue = "4"
        }

        // 构建明细行数据
        def planData = [
            // 关联主表（必须）
            product_requirement_applic__c: recordId,

            // 核心参数
            module_count__c               : moduleCount,
            cabinet_number__c             : cabinetNum,
            ai_matching_analysis_statu__c: statusValue,  // 存选项值：1=推荐 2=电流边界 3=时长临界 4=可直接推进
            min_vdc__c                   : minVdc,
            max_vdc__c                   : maxVdc,
            max_discharge_current__c     : maxCurr,
            backup_power_duration_eol__c : backupEol,
            estimated_voltage_v__c         : estVoltage,    // 估算电压

            // 扩展信息（文本字段，可存更多细节）
            special_requirement_remark__c : productName + "\n" +
                "SKU: " + skuCode + "\n" +
                "接线: " + lineType + "\n" +
                "模组消防: " + (moduleFire == "是" ? "带消防" : "不带消防") + "\n" +
                "柜体消防: " + (cabinetFire == "是" ? "带消防" : "不带消防") + "\n" +
                "功率: " + powerKw + "kW / 容量: " + capacityKwh + "kWh\n" +
                "方案状态: " + planStatus + "\n" +
                "分析说明: " + statusLabel + " - " + statusDetail + "\n" +
                "demandId: " + demandId
        ]

        // 写入 CRM
        def createResult = Fx.data.create("candidate_solution_list__c", planData)

        if (createResult.success) {
            successCount++
            log.info("[PowerQuote] 方案 ${index + 1} 写入成功: " + createResult.data?.id)
        } else {
            failCount++
            log.info("[PowerQuote] 方案 ${index + 1} 写入失败: " + Fx.json.toJson(createResult))
        }

    } catch (Exception e) {
        failCount++
        log.info("[PowerQuote] 方案 ${index + 1} 异常: " + e.getMessage())
    }
}

// ============================================================
// 第五步：弹窗展示结果
// ============================================================
def summaryText = "✅ PowerQuote 智能匹配完成！\n\n" +
    "📊 需求参数:\n" +
    "   功率: ${powerKw} kW\n" +
    "   容量: ${capacityKwh} kWh\n" +
    "   备电: ${backupMin} min\n" +
    "   DC电压: ${dcMin}-${dcMax} V\n" +
    "   场景: ${sceneLabel}\n\n" +
    "📋 候选方案清单:\n" +
    "   匹配方案: ${plans.size()} 个\n" +
    "   写入CRM: ${successCount} 个" +
    (failCount > 0 ? " ⚠️ 失败: ${failCount} 个" : "") + "\n\n"

if (writePlans.size() > 0) {
    summaryText += "【最优方案】\n"
    def top = writePlans[0]
    def topSku    = top["skuCode"]    ?: "-"
    def topCab    = top["cabinetCount"] ?: top["cabinets"] ?: "-"
    def topMod    = top["moduleCount"]  ?: top["modules"]  ?: "-"
    def topStat   = top["analysisStatusLabel"] ?: top["statusCode"] ?: ""
    def topMinVdc = top["minVdc"]     ?: dcMin
    def topMaxVdc = top["maxVdc"]     ?: dcMax
    def topCurr   = top["estimatedCurrent"] ?: 0
    summaryText += "   SKU: " + topSku + " | " + topMod + "模/" + topCab + "柜\n" +
        "   状态: " + topStat + "\n" +
        "   DC电压: " + topMinVdc + " - " + topMaxVdc + " V\n" +
        "   最大电流: " + topCurr + " A\n\n"
}

summaryText += "demandId: " + demandId

Fx.act.action.AlertAction.fire(
    title: "PowerQuote 智能匹配",
    content: summaryText
)

// 刷新页面（让用户看到新写入的候选方案清单）
Fx.act.form.reload()
