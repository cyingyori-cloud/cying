### Fxiaoke 按钮配置 Webhook 触发
按钮动作类型：`URL 跳转`
目标地址：
```
https://your-railway-url.railway.app/api/webhook/fxiaoke-sync?recordId={id}&apiKey=powerquote-webhook-secret-2026
```
> 注意：
> - `your-railway-url.railway.app` 替换为实际的 Railway 部署地址
> - `recordId={id}` 是 Fxiaoke 的内置变量，自动替换为当前记录 ID
> - 按钮需要在「产品需求申请」对象上配置