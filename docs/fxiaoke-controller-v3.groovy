/**
 * Fxiaoke 自定义控制器 - 调用 PowerQuote API 获取方案列表
 * 
 * 配置位置：Fxiaoke 管理后台 → 定制开放平台 → 自定义控制器
 * 参数配置：在编辑器右上方添加参数 Map类型 syncArg
 */

// ========== 配置 ==========
String API_BASE = 'https://cying-production.up.railway.app'
String API_KEY = 'dev-api-key-12345'
// ==========================

/**
 * 主入口函数
 */
def main(Map syncArg) {
    Map result = [:]
    
    try {
        // 1. 获取参数
        Map objectData = syncArg["objectData"] as Map
        if (!objectData) {
            return ["success": false, "message": "参数 objectData 不能为空"]
        }
        
        // 2. 获取表单字段值
        String dataId = objectData["dataId"] // 记录ID
        String objectApiName = objectData["objectApiName"] // 对象API名称
        
        // 需求参数
        Float powerKw = objectData["target_power_kw__c"] as Float
        Float capacityKwh = objectData["target_capacity_kwh__c"] as Float
        Integer backupMinutes = objectData["backup_power_duration_min__c"] as Integer
        Float dcMinVoltage = objectData["dc_min_voltage__c"] as Float ?: 520f
        Float dcMaxVoltage = objectData["dc_max_voltage__c"] as Float ?: 680f
        
        // 校验必填参数
        if (!powerKw || !capacityKwh || !backupMinutes) {
            return ["success": false, "message": "缺少必填参数：目标功率、目标容量、备电时长"]
        }
        
        // 3. 构建请求体
        Map requestBody = [
            "targetPowerKw": powerKw,
            "targetEnergyKWh": capacityKwh,
            "backupMinutes": backupMinutes,
            "dcVoltageMin": dcMinVoltage,
            "dcVoltageMax": dcMaxVoltage,
            "moduleCounts": [8, 9, 10, 12, 14, 16]
        ]
        
        // 4. 发送 HTTP POST 请求
        String url = API_BASE + "/api/demand-matching/calculate"
        Map headers = [
            "Content-Type": "application/json",
            "Authorization": "Bearer " + API_KEY
        ]
        String body = Fx.json.toJson(requestBody)
        
        def (Boolean httpError, HttpResult httpResult, String httpMsg) = http.post(url, headers, body)
        
        // 5. 处理响应
        if (httpError) {
            log.info("调用 PowerQuote API 失败：" + httpMsg)
            return ["success": false, "message": "调用失败：" + httpMsg]
        }
        
        // 6. 解析响应结果
        Map content = httpResult.content as Map
        
        if (content["error"]) {
            return ["success": false, "message": content["message"] ?: "API返回错误"]
        }
        
        // 7. 构建返回结果
        String demandId = content["demandId"] ?: ""
        List plans = content["plans"] ?: []
        
        result["success"] = true
        result["message"] = "获取到 " + plans.size() + " 个方案"
        result["demandId"] = demandId
        result["planCount"] = plans.size()
        result["solutionUrl"] = API_BASE + "/#/fxiaoke?demandId=" + demandId
        result["plans"] = plans
        
        log.info("PowerQuote 调用成功，demandId：" + demandId + "，方案数：" + plans.size())
        
    } catch (Exception e) {
        log.info("执行异常：" + e.getMessage())
        result["success"] = false
        result["message"] = "执行异常：" + e.getMessage()
    }
    
    return result
}

// Fxiaoke 入口调用
return main(syncArg)
