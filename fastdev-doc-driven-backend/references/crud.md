# CRUD And Pagination

## Single-Table CRUD

当用户要求“对某张表做 CRUD”时，先要求用户提供表结构。

可接受的表结构信息包括：

- 建表 SQL
- 字段清单
- 数据库截图整理后的字段说明
- Markdown 或 Word 中的表设计说明

至少要拿到这些信息：

- 表名
- 主键字段
- 每个字段的名称、类型、含义
- 哪些字段必填
- 哪些字段用于查询
- 哪些字段具备枚举语义

没有表结构时，不要直接开始生成 CRUD 代码。

## Recommended Order

如果任务是“根据单表结构快速生成 CRUD”，优先按下面顺序处理：

1. 获取表结构，至少包括表名、主键、字段名、类型、含义、是否必填
2. 识别字段中哪些属于枚举语义，例如状态、类型、来源、级别、性别
3. 优先定义枚举类，再生成 `Entity`、`DTO`、`Query`、请求对象
4. 先判断 `BaseController4DTO` 和 `BaseService4DTO` 是否已经覆盖基础 CRUD 与基础分页
5. 只补齐缺失的 `Mapper`、`XML`、`Service`、`ServiceImpl`、`Controller` 扩展能力
6. 最后再决定是否需要补新增、修改、删除、详情、分页查询这些扩展接口

## Paging Rules

- 分页接口不默认创建
- 只有在用户明确要求“自定义分页查询”时，才补分页接口
- 自定义分页优先使用 `PageRequest<T>`、`PageResponse<T>`、`PageWrapper`
- 简单分页优先复用基础 Service 的 `getPage`
- 复杂分页、联表或定制条件时，再新增 Mapper 方法和 XML SQL

如果用户需要自定义查询分页，优先参考现有模式：

Mapper 方法示例：

```java
IPage<UserDTO> customPage(IPage page, @Param(Constants.WRAPPER) QueryWrapper<UserEntity> wrapper);
```

XML 示例：

```xml
<select id="customPage" resultType="com.nledu.cloud.server1.domain.dto.UserDTO">
    SELECT * FROM userinfo
    ${ew.customSqlSegment}
</select>
```

自定义分页规则：

- Mapper 方法优先接收 `IPage page` 和 `@Param(Constants.WRAPPER) QueryWrapper<Entity> wrapper`
- 返回类型优先使用 `IPage<DTO>`
- ServiceImpl 中优先通过 `PageWrapper` 包装 `PageRequest`
- 调用 Mapper 时优先使用 `pageWrapper` 和 `pageWrapper.buildQueryWrapper()`
- XML 中优先通过 `${ew.customSqlSegment}` 拼接已有查询条件
- `resultType` 应与 DTO 全限定类名保持一致
- `namespace`、方法名、返回类型必须与 Mapper 接口严格对应
- 如果现有工程已经存在固定写法，优先保持与样例完全一致，不擅自改造成其他分页方案

## Query Object Rules

自定义查询和分页查询的 Query 对象，优先沿用 `@QueryField` + `Operation` 的方式描述 where 条件。

`@QueryField` 当前已知能力：

- `value()`：数据库字段名；为空时默认取参数名的驼峰映射
- `exists()`：字段是否参与条件构造
- `condition()`：条件操作符，默认 `Operation.EQ`
- `alias()`：字段别名，例如 `A.NAME`
- `ignoreClassAlias()`：是否忽略类级别别名

`Operation` 当前已知取值：

- `EQ`
- `LIKE`
- `RIGHT_LIKE`
- `LEFT_LIKE`
- `NOT_EQ`
- `IN`
- `NOT_IN`
- `GT`
- `GTE`
- `LT`
- `LTE`

生成规则：

- 默认等值查询可省略 `condition`，或显式使用 `Operation.EQ`
- 模糊查询优先使用 `Operation.LIKE`
- 左右模糊有明确要求时，再使用 `LEFT_LIKE` 或 `RIGHT_LIKE`
- 集合查询优先使用 `Operation.IN` 或 `Operation.NOT_IN`
- 范围查询优先使用 `GT`、`GTE`、`LT`、`LTE`
- 如果数据库字段名与 Java 字段名不一致，可通过 `value()` 指定字段名
- 如果涉及联表字段或明确别名字段，可通过 `alias()` 指定，例如 `A.NAME`
- 不要为了简单查询手写大量 if-else 拼接条件，优先让 Query 对象承载条件定义

示例：

```java
public class UserQuery {

    @QueryField(condition = Operation.LIKE)
    private String username;

    @QueryField(condition = Operation.IN, value = "id")
    private List<String> ids;
}
```

## Controller Rules

- 保持路径、请求方式、命名风格与现有模块一致
- 如果项目已有基础 Controller 可复用，优先继承
- 如果 `BaseController4DTO` 已能覆盖简单增删改查，就不要重复生成基础接口
- 返回值优先使用项目统一响应对象

## Service Rules

- 接口层只暴露必要方法，不堆砌重复 CRUD
- 已有基础 Service 能覆盖的能力不要重新实现
- 复杂分页可在实现类中通过 `PageWrapper` + Mapper 自定义查询完成
- 业务异常使用统一异常类型和既有错误码体系
- 若文档要求对外提供 RPC 能力，再补 `@DubboService`

## Mapper And XML Rules

- 简单场景优先复用基础 Mapper 能力
- 复杂分页、联表或自定义条件时，再增加 XML SQL
- XML 中的返回类型、namespace、方法名必须与 Mapper 接口严格对应
- 生成 SQL 时，遵循现有 QueryWrapper 或 wrapper 传递模式，不要改造整套查询机制
- 对自定义分页，优先沿用 `IPage + QueryWrapper + ${ew.customSqlSegment}` 的既有模式
