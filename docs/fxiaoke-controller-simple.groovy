import groovy.json.JsonSlurper
import groovy.json.JsonOutput

def apiUrl = 'https://cying-production.up.railway.app/api/demand-matching/calculate'
def apiKey = 'dev-api-key-12345'

def targetPowerKw = params.target_power_kw__c
if (targetPowerKw == null) targetPowerKw = 0
else targetPowerKw = targetPowerKw.toString().toFloat()

def targetEnergyKWh = params.target_capacity_kwh__c
if (targetEnergyKWh == null) targetEnergyKWh = 0
else targetEnergyKWh = targetEnergyKWh.toString().toFloat()

def backupMinutes = params.backup_power_duration_min__c
if (backupMinutes == null) backupMinutes = 0
else backupMinutes = backupMinutes.toString().toInteger()

def dcVoltageMin = params.dc_min_voltage__c
if (dcVoltageMin == null) dcVoltageMin = 520
else dcVoltageMin = dcVoltageMin.toString().toFloat()

def dcVoltageMax = params.dc_max_voltage__c
if (dcVoltageMax == null) dcVoltageMax = 680
else dcVoltageMax = dcVoltageMax.toString().toFloat()

def requestBody = [
    targetPowerKw: targetPowerKw,
    targetEnergyKWh: targetEnergyKWh,
    backupMinutes: backupMinutes,
    dcVoltageMin: dcVoltageMin,
    dcVoltageMax: dcVoltageMax,
    moduleCounts: [8, 9, 10, 12, 14, 16]
]

def url = new URL(apiUrl)
def conn = url.openConnection()
conn.setRequestMethod('POST')
conn.setDoOutput(true)
conn.setRequestProperty('Content-Type', 'application/json')
conn.setRequestProperty('Authorization', 'Bearer ' + apiKey)

def jsonBody = JsonOutput.toJson(requestBody)
conn.getOutputStream().write(jsonBody.getBytes('UTF-8'))

def response = conn.getInputStream().getText('UTF-8')
def result = new JsonSlurper().parseText(response)

def plans = result.plans
if (plans == null) plans = []

return [
    success: true,
    plans: plans,
    message: '获取方案成功'
]
