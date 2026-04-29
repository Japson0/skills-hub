# Naming And Package Rules

## Table-To-Class Naming

类名、对象名、接口名优先根据表名推导。

命名规则：

- 表名优先使用下划线转大驼峰的方式生成类名
- 例如表 `agi_agent_charging`，优先生成 `AgentChargingController`、`AgentChargingDTO`、`AgentChargingEntity`
- 应尽量判断并去除表名前缀，例如租户前缀、系统前缀、模块前缀
- 如果前缀是否属于业务语义无法可靠判断，不要强行删除，应保留前缀生成类名
- 不要把表名原样直接拼到类名中，必须转换为 Java 常规命名

推导建议：

- 明显的系统或模块前缀可尝试去掉，例如 `agi_`、`sys_`、`biz_` 这类统一前缀
- 去前缀后如果名称语义更清晰，优先使用去前缀结果
- 如果去掉前缀后可能引起歧义，保留前缀
- 包名、请求路径、Mapper XML id、Bean 命名也应与最终类名保持一致

示例：

- `agi_agent_charging` -> `AgentChargingEntity` / `AgentChargingDTO` / `AgentChargingQuery` / `AgentChargingController`
- 如果前缀无法判断必须保留，则可生成 `AgiAgentChargingEntity` / `AgiAgentChargingController`

## Package Rules

包路径不要自行设计，直接参照当前工程已有路径。

默认规则：

- `controller` 放在现有工程的 `...controller` 包下
- `service` 放在现有工程的 `...service` 包下
- `service` 实现放在现有工程的 `...service.impl` 包下
- `mapper` 或 `dao` 放在现有工程已有的数据访问层包下
- `entity` 放在现有工程的 `...model.entity` 包下
- `dto` 放在现有工程的 `...model.dto` 包下
- `query` 放在现有工程的 `...model.query` 包下
- `enums` 放在现有工程已有的枚举目录；如果当前工程已有类似 `model.enmus` 这样的历史命名，也优先保持现状，不擅自修正目录名

生成代码时，先观察当前模块已有包结构，再在相邻位置补文件。

不要做这些事：

- 不要把 `entity` 改放到一个全新的 `domain` 包
- 不要把 `dao` 自作主张改名成 `repository`
- 不要因为通用 Java 习惯就擅自重构当前工程目录
- 不要在已有目录风格明确时混用两套包结构

如有现成样例，优先对齐类似下面的路径风格：

- `com.nledu.cloud.server1.controller`
- `com.nledu.cloud.server1.service`
- `com.nledu.cloud.server1.service.impl`
- `com.nledu.cloud.server1.dao`
- `com.nledu.cloud.server1.model.entity`
- `com.nledu.cloud.server1.model.dto`
- `com.nledu.cloud.server1.model.query`

## RESTful Rules

接口路径和命名应遵循 RESTful 风格，优先使用资源名而不是动词名。

- 资源集合查询优先使用 `GET /resources` 或在项目约定下使用分页查询子路径
- 资源详情优先使用 `GET /resources/{id}`
- 资源新增优先使用 `POST /resources`
- 资源修改优先使用 `PUT /resources/{id}` 或 `PUT /resources`
- 资源删除优先使用 `DELETE /resources/{id}`
- 不要优先生成 `add`、`update`、`deleteById`、`getList` 这类路径名，除非项目现有规范明确如此
- Controller 类名、方法名、请求路径都应体现资源语义，避免出现过强的过程式命名
