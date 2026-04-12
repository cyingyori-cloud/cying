/**
 * @type classes
 * @returntype
 * @namespace apl_controller
 */
@AplController(baseUrl = "/apl")
class AplCtrlPowerQuote {

    // 调用 PowerQuote API
    @AplRequestMapping(value = "/call-powerquote", method = RequestMethod.POST)
    public HttpResponse callPowerQuote(HttpRequest request) {
        try {
            // 解析请求体
            String requestBody = new String(request.getBody(), "UTF-8")
            log.info("请求参数: " + requestBody)
            
            def data = Fx.json.parse(requestBody)
            
            // PowerQuote API 配置
            def apiBase = 'https://cying-production.up.railway.app'
            def apiKey = 'dev-api-key-12345'
            
            // 构建请求参数
            def params = [
                "targetPowerKw": data["powerKw"],
                "targetEnergyKWh": data["capacityKwh"],
                "backupMinutes": data["backupMin"],
                "dcVoltageMin": data["dcMin"] ?: 520,
                "dcVoltageMax": data["dcMax"] ?: 680,
                "moduleCounts": [8, 9, 10, 12, 14, 16]
            ]
            
            // 发送请求 - headers 和 body 分开
            def url = apiBase + '/api/demand-matching/calculate'
            def headers = [
                "Content-Type": "application/json",
                "Authorization": "Bearer " + apiKey
            ]
            
            def (Boolean error, HttpResult httpResult, String errorMsg) = Fx.http.post(url, headers, params)
            
            if (error || httpResult.statusCode != 200) {
                log.info("调用失败: " + errorMsg)
                def errorBody = ["code": 1, "message": errorMsg ?: "调用失败"]
                return HttpResponse.ok()
                    .header("Content-Type", "application/json")
                    .body(Fx.json.toJson(errorBody))
            }
            
            def content = httpResult.content
            log.info("调用成功: " + Fx.json.toJson(content))
            
            def plans = content["plans"]
            def planCount = 0
            if (plans) {
                planCount = (plans as List).size()
            }
            
            def returnBody = [
                "code": 0,
                "data": [
                    "demandId": content["demandId"],
                    "planCount": planCount,
                    "message": "获取到 " + planCount + " 个方案"
                ],
                "message": "success"
            ]
            
            return HttpResponse.ok()
                .header("Content-Type", "application/json")
                .body(Fx.json.toJson(returnBody))
                
        } catch (Exception e) {
            log.info("异常: " + e.getMessage())
            def errorBody = ["code": 1, "message": e.getMessage()]
            return HttpResponse.ok()
                .header("Content-Type", "application/json")
                .body(Fx.json.toJson(errorBody))
        }
    }
}
