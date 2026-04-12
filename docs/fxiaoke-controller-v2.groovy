/**
 * Fxiaoke 自定义控制器 - 调用 PowerQuote API
 * 版本: v2 - 简化版，兼容更多沙箱环境
 *
 * 配置位置：Fxiaoke 管理后台 → 定制开放平台 → 自定义控制器
 */

import java.net.HttpURLConnection
import java.net.URL
import java.io.OutputStreamWriter

// ========== 配置 ==========
final String API_BASE = 'https://cying-production.up.railway.app'
final String API_KEY = 'dev-api-key-12345'
// ==========================

/**
 * 发送 HTTP POST 请求（简化版）
 */
String postJson(String urlStr, String jsonBody) {
    HttpURLConnection conn = null
    try {
        URL url = new URL(urlStr)
        conn = (HttpURLConnection) url.openConnection()
        conn.requestMethod = 'POST'
        conn.doOutput = true
        conn.setRequestProperty('Content-Type', 'application/json')
        conn.setRequestProperty('Authorization', 'Bearer ' + API_KEY)
        conn.setRequestProperty('Accept', 'application/json')
        conn.connectTimeout = 15000
        conn.readTimeout = 15000

        // 写入请求体
        OutputStreamWriter writer = new OutputStreamWriter(conn.outputStream, 'UTF-8')
        writer.write(jsonBody)
        writer.flush()
        writer.close()

        // 读取响应
        int status = conn.responseCode
        InputStreamReader reader
        if (status == 200 || status == 201) {
            reader = new InputStreamReader(conn.inputStream, 'UTF-8')
        } else {
            reader = new InputStreamReader(conn.errorStream, 'UTF-8')
        }

        StringBuilder response = new StringBuilder()
        BufferedReader br = new BufferedReader(reader)
        String line
        while ((line = br.readLine()) != null) {
            response.append(line)
        }
        br.close()

        return response.toString()
    } finally {
        if (conn != null) {
            conn.disconnect()
        }
    }
}

/**
 * 构建 JSON 字符串（避免使用 JsonOutput）
 */
String buildJson(Map data) {
    StringBuilder sb = new StringBuilder()
    sb.append('{')
    def entries = data.entrySet()
    def size = entries.size()
    def count = 0
    for (entry in entries) {
        count++
        def key = entry.key
        def value = entry.value
        sb.append('"').append(key).append('":')
        if (value == null) {
            sb.append('null')
        } else if (value instanceof Number) {
            sb.append(value)
        } else if (value instanceof List) {
            sb.append('[')
            for (int i = 0; i < value.size(); i++) {
                if (i > 0) sb.append(',')
                sb.append(String.valueOf(value.get(i)))
            }
            sb.append(']')
        } else {
            sb.append('"').append(value.toString().replace('\\', '\\\\').replace('"', '\\"')).append('"')
        }
        if (count < size) sb.append(',')
    }
    sb.append('}')
    return sb.toString()
}

/**
 * 解析简单 JSON（提取 plans 数组长度）
 */
Map parseJsonResponse(String json) {
    Map result = [:]
    result.put('success', false)

    // 简单检查是否包含 error
    if (json.contains('"error"') || json.contains('"message"')) {
        // 提取 message
        def msgMatcher = json =~ /"message"\s*:\s*"([^"]*)"/
        if (msgMatcher) {
            result.put('message', msgMatcher[0][1])
        }
    }

    // 提取 demandId
    def demandMatcher = json =~ /"demandId"\s*:\s*"([^"]*)"/
    if (demandMatcher) {
        result.put('demandId', demandMatcher[0][1])
    }

    // 提取 plans 数量
    def plansMatcher = json =~ /"plans"\s*:\s*\[([^\]]*)\]/
    if (plansMatcher) {
        String plansContent = plansMatcher[0][1]
        def planCount = plansContent.split('\\{').length - 1
        result.put('planCount', planCount)
        result.put('plans', plansContent)
    }

    // 检查是否成功（包含 demandId 或 plans）
    if (result.containsKey('demandId') || result.containsKey('planCount')) {
        result.put('success', true)
    }

    return result
}

/**
 * 主入口
 */
Map main(Map params) {
    Map result = [:]

    // 1. 获取参数
    def powerKw = params.get('target_power_kw__c')
    def capacityKwh = params.get('target_capacity_kwh__c')
    def backupMin = params.get('backup_power_duration_min__c')
    def dcMin = params.get('dc_min_voltage__c')
    def dcMax = params.get('dc_max_voltage__c')
    def dataId = params.get('dataId')

    // 2. 验证必填参数
    if (!powerKw || !capacityKwh || !backupMin) {
        result.put('success', false)
        result.put('message', '缺少必填参数：功率、容量、备电时长')
        return result
    }

    // 3. 构建请求参数
    Map requestBody = [
        targetPowerKw: Float.parseFloat(String.valueOf(powerKw)),
        targetEnergyKWh: Float.parseFloat(String.valueOf(capacityKwh)),
        backupMinutes: Integer.parseInt(String.valueOf(backupMin)),
        dcVoltageMin: dcMin ? Float.parseFloat(String.valueOf(dcMin)) : 520f,
        dcVoltageMax: dcMax ? Float.parseFloat(String.valueOf(dcMax)) : 680f,
        moduleCounts: [8, 9, 10, 12, 14, 16]
    ]

    // 4. 调用 API
    try {
        String apiUrl = API_BASE + '/api/demand-matching/calculate'
        String jsonBody = buildJson(requestBody)

        String response = postJson(apiUrl, jsonBody)

        // 5. 解析响应
        Map parsed = parseJsonResponse(response)

        result.put('success', parsed.get('success', false))
        result.put('message', parsed.get('message', ''))
        result.put('demandId', parsed.get('demandId', ''))
        result.put('planCount', parsed.get('planCount', 0))
        result.put('dataId', dataId)

        // 如果需要返回方案详情
        if (parsed.get('success')) {
            // 返回 URL 供用户查看
            String demandId = parsed.get('demandId', '')
            if (demandId) {
                result.put('solutionUrl', API_BASE + '/#/fxiaoke?demandId=' + demandId)
            }
            result.put('message', '获取到 ' + parsed.get('planCount', 0) + ' 个方案')
        }

    } catch (Exception e) {
        result.put('success', false)
        result.put('message', '调用失败: ' + e.getMessage())
    }

    return result
}

// Fxiaoke 入口
return main(params)
