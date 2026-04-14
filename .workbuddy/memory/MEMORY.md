# 长期记忆

## Fxiaoke MCP 配置
- MCP URL：https://open.fxiaoke.com/mcp/831345_sandbox/crm-mcp
- API Key：FSUTK_25E0694...（已存 ~/.workbuddy/mcp.json）
- MCP 脚本：server/mcp/fxiaoke-mcp.cjs

## CRM 对象（重要）
- `product_requirement_applic__c` — 产品需求申请（核心目标对象）
  - 字段: target_power_kw__c / target_capacity_kwh__c / backup_power_duration_min__c / dc_min/max_voltage__c / scene__c
  - sync_status__c 选项字段：1=待同步, 2=同步中, 3=已完成, 4=同步失败, other=其他
  - 关联商机: project_name__c → NewOpportunityObj
- `NewOpportunityObj` — 商机项目（关联报价单 via new_opportunity_id）
- `QuoteObj` — 报价单（最终写入目标）
- `AccountObj` — 客户 | `ContactObj` — 联系人 | `LeadsObj` — 销售线索

## 闭环代码
- `docs/fxiaoke-apl-controller-v3.groovy` — APL 控制器
- `docs/fxiaoke-button-action-v2.groovy` — 按钮触发代码
- 按钮 API Name: `button_view_sku_plan_list__c`
- ⚠️ 沙箱环境不能访问外网（http timeout），生产环境可能正常

## Railway 部署
- https://cying-production.up.railway.app/
- 主题：爱马仕橙 #E8602C

## 用户信息
- 工作目录：/Users/cying/Documents/codeX/xna报价demo/powerquote-db-schema-C
- 用户公司使用 Fxiaoke CRM，需要与 PowerQuote 报价系统深度集成
