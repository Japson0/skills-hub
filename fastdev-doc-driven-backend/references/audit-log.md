# Audit Log Rules

当需求要求记录审计日志时，优先复用框架提供的 `@AuditLog` 和 `AuditObj`，不要在 Controller 或 Service 中手工拼装并持久化审计日志。只记录简单审计信息时仅标记 `@AuditLog`；需要记录被操作租户、操作类型、变更内容等扩展信息时，使用 `AuditObj` 模式返回。

下面的注解定义是当前 FastDev 工程的默认基线：

```java
package com.nlecloud.spring.annotation;

import java.lang.annotation.*;

/**
 * 自定义审计日志注解
 *
 * @author warrior
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface AuditLog {

    /**
     * 操作信息
     */
    String value() default "";

    /**
     * 业务标识符，用来标记审计业务
     */
    String businessCode() default "0000";
}
```

不同工程依赖的框架版本可能不同。生成代码前先检索目标工程中 `AuditLog`、`AuditObj` 和 `OperatorType` 的实际定义、包名、泛型及枚举值；存在差异时以目标工程源码或依赖版本为准，不要臆造 import、枚举项或字段。

## 简单记录

只需要记录操作信息、不需要记录对象变更前后内容时，在对应的方法或类上添加 `@AuditLog`：

```java
@AuditLog(value = "更新字典：#request.name", businessCode = "dictionary.update")
public DictionaryDTO update(DictionaryUpdateRequest request) {
    return dictionaryService.update(request);
}
```

使用规则：

- `@AuditLog` 可以标记方法或类；优先放在需要审计的具体业务方法上，除非明确要求整个类的所有方法使用相同审计配置。
- `value` 表示操作内容并支持 SpEL。表达式必须引用目标方法中真实存在且可解析的参数、属性或上下文，不要编造变量名。
- `businessCode` 用于标识审计业务。需求或现有工程有明确编码时使用对应值；没有依据时保留默认值 `"0000"`，不要自行设计编码体系。
- 仅在需求明确要求审计，或相邻同类业务已有稳定审计约定时添加注解，不要机械地给所有 CRUD 方法增加审计。
- 简单记录不要求为了审计改变原有业务返回类型。

## 记录详细审计信息

需要记录被操作租户、操作类型、变更前后内容、自定义操作内容等详细审计信息时，同样使用 `@AuditLog` 标记对应方法，并让方法返回 `AuditObj<S, T>`。不要求每次都同时具备所有扩展字段，根据实际审计需求设置即可。

下面是包含完整变更内容的示例：

```java
@AuditLog(value = "更新字典", businessCode = "dictionary.update")
public AuditObj<DictionaryDTO, DictionaryDTO> test() {
    DictionaryDTO dictionaryDTO = new DictionaryDTO();
    dictionaryDTO.setName("TEST1");
    DictionaryDTO newDic = new DictionaryDTO();
    newDic.setName("TEST3");
    return AuditObj.<DictionaryDTO, DictionaryDTO>builder()
            .operatorType(OperatorType.UPDATE)
            .source(dictionaryDTO)
            .target(newDic)
            .targetTenantId(111L)
            .operatorValue("测试操作")
            .result(dictionaryDTO)
            .build();
}
```

字段语义：

- `operatorType`：需要记录操作类型时，根据实际业务选择目标工程已有的 `OperatorType` 枚举值，例如更新场景使用已存在的 `OperatorType.UPDATE`。
- `source`：需要记录变更内容时，设置操作前的源值。
- `target`：需要记录变更内容时，设置操作后的目标值。
- `targetTenantId`：需要记录被操作租户时，设置被操作数据所属的租户 ID；应来自真实业务对象或可信上下文，不要硬编码示例值。
- `operatorValue`：操作内容。非空时优先使用该值，并忽略 `@AuditLog.value`。
- `result`：最终返回给方法调用方的业务结果；是否设置以及具体类型由原接口契约决定。

实现规则：

- 只要审计信息超出 `@AuditLog` 的简单操作描述，例如需要记录被操作租户，即使没有对象变更内容，也应使用 `AuditObj` 模式。
- 需要记录更新前后内容时，应在修改前读取并保留源值，修改完成后构造目标值，避免 `source` 和 `target` 引用同一个已被原地修改的对象而失去差异。
- 设置 `source`、`target` 时，其泛型和实际对象类型应保持一致；若框架版本允许不同类型，则按其真实泛型定义处理。
- `AuditObj` 是审计框架的返回载体，不要再额外手工写一套审计日志保存逻辑。
- 如果现有接口使用 `RestResult` 等统一包装，先检查项目中审计切面对 `AuditObj.result` 的解包方式和相邻样例，再确定方法签名；不要凭空嵌套成 `RestResult<AuditObj<...>>` 或改变公开接口契约。
- 如果目标工程不存在 `AuditObj`、`OperatorType` 或对应审计处理机制，应说明依赖缺失并向用户确认，而不是自行创建一套公共审计框架。
