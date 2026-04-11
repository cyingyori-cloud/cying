/**
 * Fxiaoke 自定义控制器
 * 功能：点击按钮时调用 PowerQuote API 获取方案列表
 * 
 * 配置位置：Fxiaoke 管理后台 → 定制开放平台 → 自定义控制器
 */

const https = require('https');
const http = require('http');

// PowerQuote API 配置
const POWERQUOTE_API = 'https://cying-production.up.railway.app/api/demand-matching/calculate';
const API_KEY = 'dev-api-key-12345';

/**
 * 调用 PowerQuote API
 */
function callPowerQuoteAPI(params) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify(params);
    
    const url = new URL(POWERQUOTE_API);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

/**
 * 主入口函数
 * Fxiaoke 自定义控制器会自动调用此函数
 */
async function handleRequest(params, context) {
  // 获取 Fxiaoke 传入的参数
  const {
    dataId,           // 当前记录 ID
    objectApiName,    // 对象 API Name
    scene__c,         // 场景
    target_power_kw__c,      // 目标功率 (kW)
    target_capacity_kwh__c,  // 目标容量 (kWh)
    backup_power_duration_min__c, // 备电时长 (min)
    dc_min_voltage__c,       // DC 最低电压
    dc_max_voltage__c,       // DC 最高电压
    module_fire_protection__c,  // 模组消防
    cabinet_fire_protection__c, // 机柜消防
    wiring_method__c,         // 接线方式
    special_requirement_remark__c // 特殊需求
  } = params;

  console.log('收到 Fxiaoke 请求:', JSON.stringify(params, null, 2));

  // 构建 PowerQuote API 请求参数
  const powerQuoteParams = {
    targetPowerKw: parseFloat(target_power_kw__c) || 0,
    targetEnergyKWh: parseFloat(target_capacity_kwh__c) || 0,
    backupMinutes: parseInt(backup_power_duration_min__c) || 0,
    dcVoltageMin: parseFloat(dc_min_voltage__c) || 520,
    dcVoltageMax: parseFloat(dc_max_voltage__c) || 680,
    // 其他可选参数
    ...(module_fire_protection__c && { moduleFireProtection: module_fire_protection__c }),
    ...(cabinet_fire_protection__c && { cabinetFireProtection: cabinet_fire_protection__c }),
    ...(wiring_method__c && { wiringMethod: wiring_method__c }),
    ...(special_requirement_remark__c && { remarks: special_requirement_remark__c }),
    // 默认模组数量范围
    moduleCounts: [8, 9, 10, 12, 14, 16]
  };

  try {
    // 调用 PowerQuote API
    const result = await callPowerQuoteAPI(powerQuoteParams);
    
    console.log('PowerQuote 返回结果:', JSON.stringify(result, null, 2));

    // 返回结果给 Fxiaoke
    if (result.error) {
      return {
        error: result.error,
        message: result.message || '调用 PowerQuote 失败'
      };
    }

    // 格式化返回结果
    return {
      success: true,
      dataId: dataId,
      objectApiName: objectApiName,
      solutions: result.matchedSolutions || result.solutions || [],
      message: '获取方案成功',
      rawResult: result
    };

  } catch (error) {
    console.error('调用 PowerQuote API 失败:', error);
    return {
      error: true,
      message: '网络错误：' + error.message
    };
  }
}

// 导出函数供 Fxiaoke 调用
module.exports = {
  handleRequest
};
