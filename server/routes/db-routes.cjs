// API 路由配置
module.exports = {
  // 产品目录
  'GET /api/products': '/products',
  'GET /api/products/:id': '/products/:id',

  // 需求匹配
  'GET /api/demand-matching': '/demandMatching/records',
  'GET /api/demand-matching/:id': '/demandMatching/records/:id',
  'POST /api/demand-matching': '/demandMatching/records',
  'PUT /api/demand-matching/:id': '/demandMatching/records/:id',

  // 候选方案
  'GET /api/candidate-plans/:demandId': '/candidatePlans/:demandId',

  // 报价单
  'GET /api/quotations': '/quotations/records',
  'GET /api/quotations/:id': '/quotations/records/:id',
  'POST /api/quotations': '/quotations/records',
  'PUT /api/quotations/:id': '/quotations/records/:id',
  'DELETE /api/quotations/:id': '/quotations/records/:id',
};
