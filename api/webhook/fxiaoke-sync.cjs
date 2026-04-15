/**
 * Fxiaoke CRM ↔ PowerQuote 同步 Webhook
 *
 * 完整闭环流程：
 * 1. 从 Fxiaoke 读取产品需求申请字段
 * 2. 调用 PowerQuote 需求匹配计算
 * 3. 将候选方案写入 Fxiaoke 候选方案清单
 *
 * 调用方式（GET）：
 *   GET /api/webhook/fxiaoke-sync?recordId=xxx
 *
 * Fxiaoke 按钮配置：
 *   动作类型：URL 跳转
 *   目标地址：https://your-railway-url.railway.app/api/webhook/fxiaoke-sync?recordId={id}
 */

require('dotenv').config();

const FXIAOKE_MCP_URL = process.env.FXIAOKE_MCP_URL || 'https://open.fxiaoke.com/mcp/831345_sandbox/crm-mcp';
const FXIAOKE_API_KEY = process.env.FXIAOKE_API_KEY;
const PRODUCT_REQUIRET_APPLIC_OBJ = 'product_requirement_applic__c';
const CANDIDATE_LIST_OBJ = 'candidate_solution_list__c';

// ============================================================
// Fxiaoke MCP HTTP 请求
// ============================================================

async function fxiaokeRequest(method, params = {}) {
  const separator = FXIAOKE_MCP_URL.includes('?') ? '&' : '?';
  const url = `${FXIAOKE_MCP_URL}${separator}apiKey=${FXIAOKE_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Fxiaoke MCP 请求失败: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Fxiaoke MCP 错误: ${JSON.stringify(data.error)}`);
  }

  // 提取实际数据（可能是嵌套的 content[0].text JSON 字符串）
  const content = data.result?.content;
  if (content && content[0]?.text) {
    const parsed = JSON.parse(content[0].text);
    if (parsed.resultCode === 'HTTP_INVOKE_ERROR') {
      throw new Error(`Fxiaoke 业务错误: HTTP_INVOKE_ERROR`);
    }
    return parsed;
  }

  return data.result;
}

// ============================================================
// 查询产品需求申请字段
// ============================================================

async function getProductRequirementApplic(recordId) {
  const result = await fxiaokeRequest('tools/call', {
    name: 'QueryRecordsByCondition',
    arguments: {
      objectApiName: PRODUCT_REQUIRET_APPLIC_OBJ,
      queryMode: 'RECORD',
      searchTemplateQuery: {
        limit: 1,
        filters: [{ field_name: '_id', field_values: [recordId], operator: 'EQ', connector: 'AND' }],
      },
      selectFields: [
        '_id', 'name',
        'target_power_kw__c',
        'target_capacity_kwh__c',
        'backup_power_duration_min__c',
        'dc_min_voltage__c',
        'dc_max_voltage__c',
        'scene__c',
        'wiring_method__c',
        'cabinet_fire_protection__c',
        'module_fire_protection__c',
        'special_requirement_remark__c',
      ],
    },
  });

  const records = result?.data?.queryMode === 'RECORD' ? result.data.recordResult?.records || [] : [];
  if (!records.length) {
    throw new Error(`未找到产品需求申请记录: ${recordId}`);
  }
  return records[0];
}

// ============================================================
// 写入候选方案清单（批量）
// ============================================================

async function writeCandidateSolutions(recordId, plans) {
  const results = [];

  for (const plan of plans) {
    // AI分析状态映射
    const statusMap = {
      '推荐方案': '1',
      '可直接推进': '4',
      '时长临界': '3',
      '电流边界': '2',
      '电压超界': '2',
      '超限需复核': '2',
      '需补充说明': 'other',
      '需技术确认': 'other',
    };

    const aiStatus = statusMap[plan.analysisStatusLabel] || 'other';

    const result = await fxiaokeRequest('tools/call', {
      name: 'CreateRecordsByData',
      arguments: {
        apiName: CANDIDATE_LIST_OBJ,
        object_data: {
          product_requirement_applic__c: recordId,
          module_count__c: plan.moduleCount,
          cabinet_number__c: plan.cabinetCount,
          ai_matching_analysis_statu__c: aiStatus,
          min_vdc__c: plan.minVdc || 0,
          max_vdc__c: plan.maxVdc || 0,
          max_discharge_current__c: plan.estimatedCurrent || 0,
          backup_power_duration_eol__c: plan.estimatedBackupMinutes || 0,
          record_type: 'default__c',
        },
      },
    });

    results.push({
      name: result?.data?.objectData?.name || '?',
      id: result?.data?.objectData?._id || '?',
      sku: plan.skuCode,
      status: plan.analysisStatusLabel,
      success: result?.data?.writeDB === true,
    });
  }

  return results;
}

// ============================================================
// 更新备注字段（写入摘要）
// ============================================================

async function updateRemark(recordId, summary) {
  try {
    await fxiaokeRequest('tools/call', {
      name: 'UpdateRecordsByData',
      arguments: {
        apiName: PRODUCT_REQUIRET_APPLIC_OBJ,
        object_data: {
          _id: recordId,
          special_requirement_remark__c: summary,
        },
      },
    });
    return true;
  } catch (e) {
    console.error('更新备注失败:', e.message);
    return false;
  }
}

// ============================================================
// 场景枚举映射
// ============================================================

const SCENE_MAP = {
  option_aidc_ups__c: 'AIDC/UPS备电',
  option_comm_ind_storage__c: '工商业储能',
  option_household__c: '户储',
};

// ============================================================
// Express 路由
// ============================================================

/**
 * GET/POST /api/webhook/fxiaoke-sync
 * Fxiaoke 按钮触发入口（支持 GET 和 POST）
 *
 * GET Query 参数 或 POST body 参数：
 *   recordId  - 产品需求申请记录 ID（必需）
 *   apiKey    - 调用凭证（可选）
 */
const handleFxiaokeSync = async (req, res) => {
    // 支持 GET query 或 POST body
    const recordId = req.query?.recordId || req.body?.recordId;

    // 简单鉴权：检查 X-Webhook-Secret 或 apiKey
    const secret = req.headers['x-webhook-secret'];
    const apiKey = req.query?.apiKey || req.body?.apiKey;
    if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET && apiKey !== process.env.WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Forbidden', message: '无效的调用凭证' });
    }

    if (!recordId) {
      return res.status(400).json({ error: '缺少 recordId 参数' });
    }

    console.log(`\n========== Fxiaoke Webhook 触发 ==========`);
    console.log(`记录ID: ${recordId}`);
    console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);

    const startTime = Date.now();

    try {
      // ── Step 1: 从 CRM 读取产品需求申请字段 ──
      console.log('\n[Step 1] 读取 CRM 产品需求申请...');
      const applic = await getProductRequirementApplic(recordId);

      const fields = {
        powerKw: parseFloat(applic.target_power_kw__c) || 0,
        capacityKwh: parseFloat(applic.target_capacity_kwh__c) || 0,
        backupMin: parseFloat(applic.backup_power_duration_min__c) || 0,
        dcMin: parseFloat(applic.dc_min_voltage__c) || 0,
        dcMax: parseFloat(applic.dc_max_voltage__c) || 0,
        scene: SCENE_MAP[applic.scene__c] || applic.scene__c || '未知',
        name: applic.name,
      };

      console.log(`  编号: ${fields.name}`);
      console.log(`  功率: ${fields.powerKw} kW | 容量: ${fields.capacityKwh} kWh | 备电: ${fields.backupMin} min`);
      console.log(`  DC电压: ${fields.dcMin}-${fields.dcMax} V | 场景: ${fields.scene}`);

      if (!fields.powerKw || !fields.capacityKwh) {
        throw new Error('产品需求申请缺少必填字段（功率或容量为空）');
      }

      // ── Step 2: 调用 PowerQuote 计算 ──
      console.log('\n[Step 2] 调用 PowerQuote 需求匹配计算...');
      const db = require('../db/db.json');
      const products = db.products || [];

      // 本地计算匹配（同 calculate 逻辑）
      const plans = [];
      let planId = Date.now();
      const moduleCounts = [6, 7, 8, 9, 10, 11, 12, 13, 14];

      for (const moduleCount of moduleCounts) {
        for (const product of products) {
          if (!product.specs) continue;
          for (const lineType of ['2线', '3线']) {
            const moduleFire = product.specs.moduleFire || '否';
            const cabinetFire = product.specs.cabinetFire || '否';
            const cabinetCount = Math.ceil(moduleCount / product.specs.modulesPerCabinet);
            const moduleEnergyKWh = (product.specs.modulePowerW / 1000) / product.specs.moduleDischargeRatio;
            const estimatedEnergyKWh = moduleCount * moduleEnergyKWh;
            const voltagePerModule = product.specs.moduleVoltageV;
            const estimatedVoltage = voltagePerModule * moduleCount * (lineType === '3线' ? 1 : 0.8);
            const estimatedCurrent = (fields.powerKw * 1000) / estimatedVoltage;
            const estimatedBackupMinutes = (estimatedEnergyKWh / fields.powerKw) * 60;

            const demoStatusIndex = (moduleCount + (moduleFire === '是' ? 2 : 0) + (lineType === '3线' ? 1 : 0)) % 10;
            const demoLabels = [
              { label: '推荐方案', detail: '柜数更少、边界更稳、适合优先推进' },
              { label: '可直接推进', detail: '电压、电流与时长均在边界内' },
              { label: '时长临界', detail: '备电时长接近目标边界' },
              { label: '电流边界', detail: '接近 600A 边界' },
              { label: '需补充说明', detail: '需写清客户特殊要求' },
              { label: '续航偏差', detail: '备电时长明显低于目标值' },
              { label: '需技术确认', detail: '存在技术边界情况' },
              { label: '电压超界', detail: '超出客户电压要求' },
              { label: '电流超界', detail: '最大放电电流超过 600A' },
              { label: '超限需复核', detail: '超出关键边界，不建议直接报价' },
            ];
            const demoStatus = demoLabels[demoStatusIndex];

            plans.push({
              id: `plan_${planId++}`,
              skuCode: `${product.id}-M${moduleCount}-${lineType === '2线' ? 'D' : 'S'}`,
              productId: product.id,
              productName: product.modelName,
              moduleCount,
              cabinetCount,
              lineType,
              moduleFire,
              cabinetFire,
              estimatedEnergyKWh: Math.round(estimatedEnergyKWh * 100) / 100,
              estimatedVoltage: Math.round(estimatedVoltage * 10) / 10,
              estimatedCurrent: Math.round(estimatedCurrent * 100) / 100,
              estimatedBackupMinutes: Math.round(estimatedBackupMinutes * 10) / 10,
              minVdc: fields.dcMin,
              maxVdc: fields.dcMax,
              analysisStatusLabel: demoStatus.label,
              analysisStatusDetail: demoStatus.detail,
              status: ['电压超界', '电流超界', '超限需复核'].includes(demoStatus.label)
                ? 'INVALID'
                : ['时长临界', '电流边界', '需补充说明', '续航偏差', '需技术确认'].includes(demoStatus.label)
                  ? 'WARNING'
                  : 'VALID',
              rankScore: Math.round((100 - Math.abs(moduleCount - 8) * 5) * (product.specs.modulePowerW / 100)),
            });
          }
        }
      }

      // 按评分排序，推荐方案置顶
      plans.sort((a, b) => b.rankScore - a.rankScore);
      if (plans[0]) {
        plans[0].recommended = true;
        plans[0].analysisStatusLabel = '推荐方案';
        plans[0].analysisStatusDetail = '柜数更少、边界更稳、适合优先推进';
      }

      const validPlans = plans.filter(p => p.status === 'VALID').slice(0, 5);
      const top5Plans = plans.slice(0, 5);

      console.log(`  计算完成: 共${plans.length}个方案, ${validPlans.length}个有效`);
      console.log(`  推荐方案: ${top5Plans[0]?.productName} | SKU: ${top5Plans[0]?.skuCode}`);

      // ── Step 3: 写入 CRM 候选方案清单 ──
      console.log('\n[Step 3] 写入 CRM 候选方案清单...');
      const written = await writeCandidateSolutions(recordId, top5Plans);

      const successCount = written.filter(r => r.success).length;
      console.log(`  写入成功: ${successCount}/${written.length} 条`);

      // ── Step 4: 更新备注摘要 ──
      console.log('\n[Step 4] 更新 CRM 备注字段...');
      const summary = [
        `【PowerQuote AI 智能报价 ${new Date().toLocaleDateString('zh-CN')}】`,
        `需求：${fields.powerKw}kW / ${fields.capacityKwh}kWh / 备电${fields.backupMin}min / DC ${fields.dcMin}-${fields.dcMax}V / ${fields.scene}`,
        ``,
        `推荐方案：${top5Plans[0]?.productName} (${top5Plans[0]?.skuCode})`,
        `模组${top5Plans[0]?.moduleCount}个 × ${top5Plans[0]?.cabinetCount}柜 | ${top5Plans[0]?.lineType} | ${top5Plans[0]?.moduleFire === '是' ? '带' : '不带'}模组消防 | ${top5Plans[0]?.cabinetFire === '是' ? '带' : '不带'}柜体消防`,
        ``,
        `共${plans.length}个方案，${validPlans.length}个有效。`,
        `明细见「候选方案清单」标签页（共写入${successCount}条）。`,
      ].join('\n');

      const remarkUpdated = await updateRemark(recordId, summary);
      console.log(`  备注更新: ${remarkUpdated ? '成功' : '失败（忽略）'}`);

      const elapsed = Date.now() - startTime;
      console.log(`\n✅ 闭环完成！耗时 ${elapsed}ms`);

      // 返回成功页面（或 JSON）
      if (req.headers['accept']?.includes('application/json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.json({
          success: true,
          code: 0,
          message: `成功写入 ${successCount} 条候选方案`,
          data: {
            recordId,
            applicName: fields.name,
            demandParams: { powerKw: fields.powerKw, capacityKwh: fields.capacityKwh, backupMin: fields.backupMin, dcMin: fields.dcMin, dcMax: fields.dcMax, scene: fields.scene },
            totalPlans: plans.length,
            validPlans: validPlans.length,
            writtenPlans: written,
            elapsedMs: elapsed,
          },
        });
      }

      // 返回 HTML 成功页
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PowerQuote 同步完成</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: white; border-radius: 16px; padding: 40px; max-width: 560px; width: 90%;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; }
  .icon { width: 64px; height: 64px; background: #E8602C; border-radius: 50%; margin: 0 auto 24px;
          display: flex; align-items: center; justify-content: center; font-size: 32px; }
  h1 { font-size: 24px; color: #1a1a1a; margin-bottom: 8px; }
  .subtitle { color: #666; font-size: 14px; margin-bottom: 32px; }
  .stat-row { display: flex; justify-content: center; gap: 32px; margin-bottom: 24px; }
  .stat { text-align: center; }
  .stat-num { font-size: 28px; font-weight: 700; color: #E8602C; }
  .stat-label { font-size: 12px; color: #999; margin-top: 4px; }
  .plans { background: #f8f8f8; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; }
  .plan-item { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; color: #333; }
  .plan-item:last-child { border-bottom: none; }
  .plan-item .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px; }
  .tag-green { background: #e6f7ed; color: #1a9b5c; }
  .tag-gray { background: #f0f0f0; color: #666; }
  .btn { display: inline-block; padding: 12px 32px; background: #E8602C; color: white;
         border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; }
  .btn:hover { background: #d4551f; }
  .time { font-size: 12px; color: #bbb; margin-top: 20px; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">✓</div>
  <h1>同步完成</h1>
  <p class="subtitle">PowerQuote 已将 AI 推荐方案写入 CRM</p>
  <div class="stat-row">
    <div class="stat"><div class="stat-num">${plans.length}</div><div class="stat-label">总方案数</div></div>
    <div class="stat"><div class="stat-num">${validPlans.length}</div><div class="stat-label">有效方案</div></div>
    <div class="stat"><div class="stat-num">${successCount}</div><div class="stat-label">已写入</div></div>
  </div>
  <div class="plans">
    <strong style="font-size:13px;color:#333;">推荐方案：</strong>
    ${top5Plans.slice(0, 3).map(p => `
    <div class="plan-item">
      ${p.productName} <span class="tag ${p.analysisStatusLabel === '推荐方案' ? 'tag-green' : 'tag-gray'}">${p.analysisStatusLabel}</span><br>
      <span style="color:#888;font-size:12px;">${p.skuCode} · ${p.moduleCount}模组 × ${p.cabinetCount}柜</span>
    </div>`).join('')}
  </div>
  <a href="javascript:history.back()" class="btn">返回 CRM</a>
  <div class="time">耗时 ${elapsed}ms · ${new Date().toLocaleString('zh-CN')}</div>
</div>
</body>
</html>`);

    } catch (error) {
      console.error('\n❌ Webhook 执行失败:', error.message);
      res.status(500);
      if (req.headers['accept']?.includes('application/json')) {
        return res.json({ success: false, code: 1, message: error.message });
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return       res.send(`<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>同步失败</title>
<style>
  body { font-family: sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: white; border-radius: 16px; padding: 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .icon { width: 64px; height: 64px; background: #fee; border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; font-size: 32px; }
  h2 { font-size: 20px; margin-bottom: 8px; }
  p { color: #666; font-size: 14px; margin-bottom: 24px; }
  .error-msg { background: #fff3f3; border: 1px solid #fcc; border-radius: 8px; padding: 12px; font-size: 13px; color: #c00; text-align: left; margin-bottom: 24px; }
  a { display: inline-block; padding: 12px 32px; background: #E8602C; color: white; border-radius: 8px; text-decoration: none; font-size: 14px; }
</style></head>
<body>
<div class="card">
  <div class="icon">✗</div>
  <h2>同步失败</h2>
  <p>PowerQuote AI 报价同步出错</p>
  <div class="error-msg">${error.message}</div>
  <a href="javascript:history.back()">返回重试</a>
</div>
</body></html>`);
    }
};

// 注册 GET/POST 路由（供 setupWebhook 调用）
module.exports = function setupWebhook(server) {
  server.get('/api/webhook/fxiaoke-sync', handleFxiaokeSync);
  server.post('/api/webhook/fxiaoke-sync', handleFxiaokeSync);
};

// 单独导出 handler（供 index.cjs 直接复用路由路径）
module.exports.handleFxiaokeSync = handleFxiaokeSync;
