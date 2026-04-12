/**
 * Fxiaoke 自定义控制器 - 调用 PowerQuote API 获取方案列表
 * 
 * 配置位置：Fxiaoke 管理后台 → 定制开放平台 → 自定义控制器
 * 参数配置：在编辑器右上方添加参数 Map类型，名称为 syncArg
 */

// ========== 配置 ==========
def API_BASE = 'https://cying-production.up.railway.app'
def API_KEY = 'dev-api-key-12345'
// ==========================

// 主入口
def handleRequest() {
    def result = [:]
    
    try {
        // 1. 获取参数
        def objectData = syncArg["objectData"]
        if (!objectData) {
            return ["success": false, "message": "参数 objectData 不能为空"]
        }
        
        // 2. 获取表单字段值
        def dataId = objectData["dataId"]
        
        // 需求参数
        def powerKw = objectData["target_power_kw__c"]
        def capacityKwh = objectData["target_capacity_kwh__c"]
        def backupMinutes = objectData["backup_power_duration_min__c"]
        def dcMinVoltage = objectData["dc_min_voltage__c"] ?: 520
        def dcMaxVoltage = objectData["dc_max_voltage__c"] ?: 680
        
        // 校验必填参数
        if (!powerKw || !capacityKwh || !backupMinutes) {
            return ["success": false, "message": "缺少必填参数：目标功率、目标容量、备电时长"]
        }
        
        // 3. 构建请求体
        def requestBody = [
            "targetPowerKw": powerKw,
            "targetEnergyKWh": capacityKwh,
            "backupMinutes": backupMinutes,
            "dcVoltageMin": dcMinVoltage,
            "dcVoltageMax": dcMaxVoltage,
            "moduleCounts": [8, 9, 10, 12, 14, 16]
        ]
        
        // 4. 发送 HTTP POST 请求
        def url = API_BASE + '/api/demand-matching/calculate'
        def headers = [
            "Content-Type": "application/json",
            "Authorization": "Bearer " + API_KEY
        ]
        def body = Fx.json.toJson(requestBody)
        
        def (Boolean httpError, httpResult, String httpMsg) = http.post(url, headers, body)
        
        // 5. 处理响应
        if (httpError) {
            log.info("调用 PowerQuote API 失败：" + httpMsg)
            return ["success": false, "message": "调用失败：" + httpMsg]
        }
        
        // 6. 解析响应结果
        def content = httpResult.content
        
        if (content["error"]) {
            return ["success": false, "message": content["message"] ?: "API返回错误"]
        }
        
        // 7. 构建返回结果
        def demandId = content["demandId"] ?: ""
        def plans = content["plans"] ?: []
        def planCount = plans.size()
        
        log.info("PowerQuote 调用成功，demandId：" + demandId + "，方案数：" + planCount)
        
        // 返回结果
        return [
            "success": true,
            "message": "获取到 " + planCount + " 个方案",
            "demandId": demandId,
            "planCount": planCount,
            "solutionUrl": API_BASE + "/#/fxiaoke?demandId=" + demandId
        ]
        
    } catch (Exception e) {
        log.info("执行异常：" + e.getMessage())
        return ["success": false, "message": "执行异常：" + e.getMessage()]
    }
}

// 执行入口
return handleRequest()
