// 测试按钮代码

// 获取参数
def powerKw = context.data.target_power_kw__c
def capacityKwh = context.data.target_capacity_kwh__c
def backupMin = context.data.backup_power_duration_min__c

// 测试：用 Alert 显示参数
def text = "参数测试：\n功率=" + powerKw + "\n容量=" + capacityKwh + "\n备电=" + backupMin

UIAction alertAction = AlertAction.builder()
    .type("default")
    .text(text)
    .build()

return alertAction
