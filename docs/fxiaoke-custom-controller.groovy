/**
 * Fxiaoke 自定义控制器 - Groovy 版本
 * 功能：点击按钮时调用 PowerQuote API 获取方案列表
 * 
 * 配置位置：Fxiaoke 管理后台 → 定制开放平台 → 自定义控制器
 */

import groovy.json.JsonSlurper
import groovy.json.JsonOutput

// PowerQuote API 配置
final String POWERQUOTE_API = 'https://cying-production.up.railway.app/api/demand-matching/calculate'
final String API_KEY = 'dev-api-key-12345'

/**
 * 调用 PowerQuote API
 */
def callPowerQuoteAPI(Map params) {
    def url = new URL(POWERQUOTE_API)
    def connection = url.openConnection() as HttpURLConnection
    
    try {
        connection.requestMethod = 'POST'
        connection.doOutput = true
        connection.setRequestProperty('Content-Type', 'application/json')
        connection.setRequestProperty('Authorization', "Bearer ${API_KEY}")
        
        def requestData = JsonOutput.toJson(params)
        connection.outputStream.write(requestData.getBytes('UTF-8'))
        
        def responseCode = connection.responseCode
        def responseText
        
        if (responseCode == HttpURLConnection.HTTP_OK) {
            responseText = connection.inputStream.text
        } else {
            responseText = connection.errorStream.text
        }
        
        return new JsonSlurper().parseText(responseText)
    } finally {
        connection.disconnect()
    }
}

/**
 * 主入口函数 - Fxiaoke 会自动调用
 */
def handleRequest(Map params, Map context) {
    // 获取 Fxiaoke 传入的参数
    def dataId = params.dataId
    def objectApiName = params.objectApiName
    def scene = params.scene__c
    def targetPowerKw = params.target_power_kw__c
    def targetCapacityKwh = params.target_capacity_kwh__c
    def backupMinutes = params.backup_power_duration_min__c
    def dcMinVoltage = params.dc_min_voltage__c
    def dcMaxVoltage = params.dc_max_voltage__c
    def moduleFireProtection = params.module_fire_protection__c
    def cabinetFireProtection = params.cabinet_fire_protection__c
    def wiringMethod = params.wiring_method__c
    def specialRequirement = params.special_requirement_remark__c
    
    // 转换参数
    def powerQuoteParams = [
        targetPowerKw: targetPowerKw ? targetPowerKw.toFloat() : 0f,
        targetEnergyKWh: targetCapacityKwh ? targetCapacityKwh.toFloat() : 0f,
        backupMinutes: backupMinutes ? backupMinutes.toInteger() : 0,
        dcVoltageMin: dcMinVoltage ? dcMinVoltage.toFloat() : 520f,
        dcVoltageMax: dcMaxVoltage ? dcMaxVoltage.toFloat() : 680f,
        moduleCounts: [8, 9, 10, 12, 14, 16]
    ]
    
    // 添加可选参数
    if (moduleFireProtection) {
        powerQuoteParams.moduleFireProtection = moduleFireProtection
    }
    if (cabinetFireProtection) {
        powerQuoteParams.cabinetFireProtection = cabinetFireProtection
    }
    if (wiringMethod) {
        powerQuoteParams.wiringMethod = wiringMethod
    }
    if (specialRequirement) {
        powerQuoteParams.remarks = specialRequirement
    }
    
    try {
        // 调用 PowerQuote API
        def result = callPowerQuoteAPI(powerQuoteParams)
        
        // 返回结果
        if (result.error) {
            return [
                error: true,
                message: result.message ?: '调用 PowerQuote 失败'
            ]
        }
        
        return [
            success: true,
            dataId: dataId,
            objectApiName: objectApiName,
            scene: scene,
            plans: result.plans ?: [],
            demandId: result.demandId,
            message: '获取方案成功',
            totalPlans: result.plans?.size() ?: 0
        ]
        
    } catch (Exception e) {
        return [
            error: true,
            message: "网络错误：${e.message}"
        ]
    }
}

// 返回结果
return handleRequest(params, context)
