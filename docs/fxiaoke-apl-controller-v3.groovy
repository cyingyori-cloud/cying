/**
 * @type classes
 * @returntype
 * @namespace apl_controller
 *
 * 产品需求申请 → PowerQuote 智能报价 → 候选方案清单
 *
 * 【按钮配置】
 * - 按钮 API Name: button_sync_powerquote__c
 * - 按钮类型: 执行代码（执行脚本）
 * - 按钮代码见同目录 fxiaoke-button-action-v2.groovy
 *
 * 【工作流程】（按钮触发）
 * 1. 读取当前产品需求申请记录的字段参数
 * 2. 调用 PowerQuote 需求匹配接口（/api/demand-matching/calculate）
 * 3. 解析所有有效方案
 * 4. 逐条写入「候选方案清单」(candidate_solution_list__c)
 * 5. 弹窗展示结果摘要，刷新页面
 *
 * 【字段映射】
 * CRM 字段 → PowerQuote 参数
 * target_power_kw__c          → targetPowerKw
 * target_capacity_kwh__c       → targetEnergyKWh
 * backup_power_duration_min__c → backupMinutes
 * dc_min_voltage__c           → dcVoltageMin
 * dc_max_voltage__c           → dcVoltageMax
 * scene__c                    → 场景标签
 *
 * 【PowerQuote 响应 → candidate_solution_list__c 字段】
 * plan["moduleCount"]   → module_count__c
 * plan["cabinetNumber"] → cabinet_number__c
 * plan["statusCode"]    → ai_matching_analysis_statu__c
 * plan["minVdc"]        → min_vdc__c
 * plan["maxVdc"]        → max_vdc__c
 * plan["maxDischargeCurrent"] → max_discharge_current__c
 * plan["backupDurationEol"]   → backup_power_duration_eol__c
 *
 * 【注意事项】
 * - 此代码在 Fxiaoke 服务器端执行
 * - PowerQuote 服务需对外可访问（生产环境可访问外网，沙箱可能受限）
 * - candidate_solution_list__c 的 Create 操作需确认沙箱权限
 * - AI状态枚举：1=推荐方案, 2=电流边界, 3=时长临界, 4=可直接推进
 */
@AplController(baseUrl = "/apl")
class AplCtrlPowerQuote {

    @AplRequestMapping(value = "/call-powerquote", method = RequestMethod.POST)
    public HttpResponse callPowerQuote(HttpRequest request) {
        try {
            String requestBody = new String(request.getBody(), "UTF-8")
            log.info("[PowerQuote] 请求参数: " + requestBody)

            def body = Fx.json.parse(requestBody)

            def recordId    = body["recordId"]
            def powerKw     = body["targetPowerKw"]
            def capacityKwh = body["targetCapacityKwh"]
            def backupMin   = body["backupMin"]
            def dcMin       = body["dcMin"] ?: 520
            def dcMax       = body["dcMax"] ?: 680
            def oppId       = body["oppId"]
            def scene       = body["scene"]

            log.info("[PowerQuote] 功率=${powerKw}kW 容量=${capacityKwh}kWh 备电=${backupMin}min")

            def (Boolean callErr, HttpResult httpResult, String callErrMsg) = callPowerQuoteApi(
                powerKw, capacityKwh, backupMin, dcMin, dcMax
            )

            if (callErr || httpResult.statusCode != 200) {
                log.info("[PowerQuote] API 调用失败: " + callErrMsg)
                return jsonResponse([code: 1, message: "调用 PowerQuote 失败: " + callErrMsg])
            }

            def apiResult = Fx.json.parse(httpResult.content)
            def plans = apiResult["plans"] ?: []
            def demandId = apiResult["demandId"]

            log.info("[PowerQuote] API 返回成功，匹配到 ${plans.size()} 个方案")

            return jsonResponse([
                code    : 0,
                message : "success",
                data    : [
                    demandId  : demandId,
                    planCount : plans.size(),
                    plans     : plans,
                    message   : "获取到 " + plans.size() + " 个匹配方案"
                ]
            ])

        } catch (Exception e) {
            log.info("[PowerQuote] 异常: " + e.getMessage())
            return jsonResponse([code: 1, message: "系统异常: " + e.getMessage()])
        }
    }

    // ============================================================
    // 工具方法
    // ============================================================

    private Tuple3<Boolean, HttpResult, String> callPowerQuoteApi(
        def powerKw, def capacityKwh, def backupMin, def dcMin, def dcMax
    ) {
        try {
            def apiBase = 'https://cying-production.up.railway.app'
            def apiKey  = 'dev-api-key-12345'   // TODO: 替换为真实 API Key
            def url = apiBase + '/api/demand-matching/calculate'

            def reqBody = [
                targetPowerKw    : powerKw,
                targetEnergyKWh  : capacityKwh,
                backupMinutes    : backupMin,
                dcVoltageMin     : dcMin,
                dcVoltageMax     : dcMax,
                moduleCounts     : [8, 9, 10, 11, 12, 14, 16],
                moduleFireFilter : "ALL",
                cabinetFireFilter: "ALL",
                lineTypeFilter   : "ALL"
            ]

            def headers = [
                "Content-Type" : "application/json",
                "Authorization": "Bearer " + apiKey
            ]

            log.info("[PowerQuote] 调用 API: " + url)
            def (Boolean err, HttpResult result, String errMsg) = Fx.http.post(url, headers, reqBody)
            return new Tuple3<Boolean, HttpResult, String>(err, result, errMsg)

        } catch (Exception e) {
            log.info("[PowerQuote] HTTP 调用异常: " + e.getMessage())
            return new Tuple3<Boolean, HttpResult, String>(true, null, e.getMessage())
        }
    }

    private HttpResponse jsonResponse(Map body) {
        return HttpResponse.ok()
            .header("Content-Type", "application/json")
            .body(Fx.json.toJson(body))
    }
}
