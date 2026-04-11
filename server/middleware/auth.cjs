/**
 * 认证中间件 - API Key 验证
 * 使用方式：在路由前添加 requireAuth 中间件
 *
 * 请求头格式：Authorization: Bearer <API_KEY>
 */
const API_KEYS = new Set([
  process.env.API_KEY_1,
  process.env.API_KEY_2,
  process.env.API_KEY_3,
].filter(Boolean));

const AUTH_DISABLED = process.env.AUTH_DISABLED === 'true';

function requireAuth(req, res, next) {
  // 开发环境可禁用认证
  if (AUTH_DISABLED) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <API_KEY>',
    });
  }

  const token = authHeader.slice(7);
  if (!API_KEYS.has(token)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
  }

  next();
}

module.exports = { requireAuth };
