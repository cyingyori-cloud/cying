/**
 * 输入校验中间件 - 需求匹配参数校验
 */

const VALID_MODULE_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const VALID_LINE_TYPES = ['2线', '3线'];
const VALID_FIRE_FILTERS = ['ALL', 'YES', 'NO'];

function validateDemandParams(req, res, next) {
  const {
    targetPowerKw,
    targetEnergyKWh,
    backupMinutes,
    dcVoltageMin,
    dcVoltageMax,
    moduleCounts,
  } = req.body;

  const errors = [];

  // 功率校验 (1-10000 kW)
  if (typeof targetPowerKw !== 'number' || targetPowerKw < 1 || targetPowerKw > 10000) {
    errors.push('targetPowerKw 必须是 1-10000 之间的数字');
  }

  // 能量校验 (1-10000 kWh)
  if (typeof targetEnergyKWh !== 'number' || targetEnergyKWh < 1 || targetEnergyKWh > 10000) {
    errors.push('targetEnergyKWh 必须是 1-10000 之间的数字');
  }

  // 备电时长校验 (0-1440 分钟)
  if (typeof backupMinutes !== 'number' || backupMinutes < 0 || backupMinutes > 1440) {
    errors.push('backupMinutes 必须是 0-1440 之间的数字');
  }

  // DC 电压范围校验 (0-1000 V)
  if (typeof dcVoltageMin !== 'number' || dcVoltageMin < 0 || dcVoltageMin > 1000) {
    errors.push('dcVoltageMin 必须是 0-1000 之间的数字');
  }
  if (typeof dcVoltageMax !== 'number' || dcVoltageMax < 0 || dcVoltageMax > 1000) {
    errors.push('dcVoltageMax 必须是 0-1000 之间的数字');
  }
  if (dcVoltageMin >= dcVoltageMax) {
    errors.push('dcVoltageMax 必须大于 dcVoltageMin');
  }

  // 模组数量校验
  if (!Array.isArray(moduleCounts) || moduleCounts.length === 0) {
    errors.push('moduleCounts 必须是至少包含一个元素的数组');
  } else {
    const invalidCounts = moduleCounts.filter(c => !VALID_MODULE_COUNTS.includes(c));
    if (invalidCounts.length > 0) {
      errors.push(`moduleCounts 包含无效值: ${invalidCounts.join(', ')}，有效值: ${VALID_MODULE_COUNTS.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      messages: errors,
    });
  }

  next();
}

module.exports = { validateDemandParams, VALID_MODULE_COUNTS, VALID_LINE_TYPES, VALID_FIRE_FILTERS };
