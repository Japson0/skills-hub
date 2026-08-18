---
name: fastdev-doc-driven-backend
description: Use this skill whenever the user wants to implement, scaffold, or plan a backend feature from development documentation in a FastDev-style Spring project. Trigger whenever the request involves reading docs, table structures, interface specs, or existing sample modules and then generating code that should match established patterns such as Controller, Service, Mapper/XML, Entity, DTO, Query, BaseController4DTO, BaseService4DTO, custom pagination, QueryField-based querying, validation annotations, encryption, i18n, RestResult, BusinessException, or UserContext usage. Use it even if the user only says things like "根据开发文档开发", "参考样例生成", "按表结构生成CRUD", "补一个分页查询", or "照着现有工程写" without explicitly asking for a skill.
---

# FastDev Doc-Driven Backend

这个 skill 用来把开发文档转换成符合既有工程规范的后端实现。

目标不是“凭空生成一套代码”，而是先读文档，再严格套用项目里已经存在的开发模式，输出可以直接落地的实现、脚手架或者任务拆解。

## 参考文件

根据任务类型按需读取这些文件，不需要每次都展开全部细则：

- `references/base-classes.md`
  适用于判断 `BaseController4DTO`、`BaseService4DTO` 已覆盖哪些能力，以及是否需要自定义扩展接口
- `references/project-init.md`
  适用于从零初始化 FastDev 风格项目
- `references/crud.md`
  适用于单表 CRUD、分页、自定义分页、Mapper/XML 生成
- `references/naming.md`
  适用于表名转类名、前缀裁剪、包路径、RESTful 路径命名
- `references/validation.md`
  适用于参数校验、自定义 validation 注解、枚举生成规则、逻辑删除、i18n 文案规则
- `references/user-context.md`
  适用于读取当前用户、角色、租户、组织、手机号验证状态，以及处理系统用户和登录态判断

## 适用场景

当用户提出以下类型的需求时使用这个 skill：

- 根据需求文档或接口文档开发一个后端接口
- 从零初始化一个符合 FastDev 风格的新项目或新模块
- 根据单表结构快速生成 CRUD 模块
- 根据现有样例模块，生成同风格的增删改查代码
- 根据开发规范文档，补齐 Controller、Service、Mapper、XML、Entity、DTO、Query
- 根据字段说明实现分页查询、条件查询、字段加密
- 根据已有 Dubbo API 或内部接口约定生成服务实现
- 根据开发文档先产出任务拆解或实施方案，再决定是否写代码

如果只是泛泛地讨论方案，没有实际文档，也没有要求遵循现有工程风格，就不要使用这个 skill。

## 先做什么

收到任务后，先不要急着写代码。按下面顺序执行：

1. 如果任务是从零创建项目，优先确认是否应直接使用现有 Maven archetype 初始化，而不是手工搭目录。
2. 找到并阅读开发文档、接口文档、样例代码、模块结构。
3. 如果任务是针对某张表生成 CRUD，先确认用户已提供表结构；没有表结构时，不要臆造字段。
4. 确认这是在现有 FastDev 风格工程上继续开发，而不是另起一套架构。
5. 提炼下面这些信息：
   - 功能目标
   - 请求路径和请求方式
   - 入参结构
   - 返回结构
   - 数据表或实体字段
   - 查询条件和分页要求
   - 是否需要 Dubbo 暴露
   - 是否涉及国际化、脱敏、加密、业务异常
   - 验收条件
6. 区分清楚：
   - 文档明确写出的事实
   - 根据现有样例做出的合理推断
   - 文档缺失但会影响正确性的关键信息
7. 如果缺失信息会影响接口行为、表结构、加密方式或服务边界，先问一个简短问题；否则按最小正确实现继续。

## 核心原则

- 优先遵循文档和现有代码样例，不要擅自设计一套新分层。
- 如果任务是初始化新项目，优先复用既有 archetype，不要手工从空目录拼装基础工程。
- 优先复用项目里的基础能力，例如基础 Controller、基础 Service、分页封装、查询注解、统一返回。
- 能复用已有模式就不要重复发明辅助类。
- 文档没写清楚时，不要凭空虚构字段、错误码、业务规则。
- 如果文档和样例冲突，先指出冲突，再按用户意图决定跟文档还是跟现有代码。
- reference 中的基础类方法、HTTP 动词、`UserContext` 行为是默认基线，套用前先检查目标工程源码或相邻样例；存在差异时以目标工程实际实现为准。

## 按场景读取

reference 文件记录的是该工程的默认基线规则。但不同工程的基础类版本、签名、包路径、`UserContext` 实现细节可能存在差异。因此，在套用 reference 中的具体 API、方法签名、HTTP 动词或上下文行为前，先打开目标工程中已有源码或相邻样例模块进行确认。只有当目标工程与 reference 描述一致时，才直接套用；存在差异时，以目标工程实际实现为准，并向用户指出差异。

reference 之间不是孤立的，一次任务通常需要同时读取多个文件。按下表组合加载：

| 任务场景 | 必读 | 按需追加 |
| --- | --- | --- |
| 单表 CRUD、分页、自定义分页 | `references/crud.md`、`references/base-classes.md`、`references/naming.md` | 涉及校验、枚举、加密、逻辑删除、i18n 时追加 `references/validation.md` |
| 业务异常与返回包装 | `references/base-classes.md` | 涉及 i18n key 选择时追加 `references/validation.md` |
| 用户、角色、租户、组织、登录态 | `references/user-context.md`、`references/base-classes.md` | 涉及异常或 i18n 时追加 `references/validation.md` |
| 参数校验、枚举、加密、逻辑删除、i18n 文案 | `references/validation.md` | 涉及实体或 Controller 生成时追加 `references/crud.md`、`references/base-classes.md` |
| 类名推导、包路径、RESTful 命名 | `references/naming.md` | 涉及 CRUD 或基础类复用时追加 `references/crud.md`、`references/base-classes.md` |
| 从零创建项目或初始化基础工程 | `references/project-init.md` | 初始化完成后再按实际业务场景加载上面对应文件 |

只按单个文件路由容易只拿到半套规则，例如 CRUD 任务如果不读 `base-classes.md`，就不知道基础类已经覆盖了哪些接口，容易重复生成。

## 识别这个工程的典型模式

当你在类似以下结构的工程里工作时，优先延续这些模式：

- `controller` 层负责暴露 HTTP 接口
- `service` 接口定义业务能力
- `service/impl` 实现业务逻辑
- `dao` 或 `mapper` 负责数据库访问
- `resources/mapper/*.xml` 编写自定义 SQL
- `model/entity` 放实体
- `model/dto` 放返回 DTO
- `model/query` 放查询对象

对于当前样例工程，可优先识别这些习惯：

- Controller 使用 `@RestController`、`@RequestMapping`
- 返回值优先使用项目统一返回包装
- Service 可能继承 `BaseService4DTO`，实现类继承 `BaseService4DTOImpl`
- 分页查询使用 `PageRequest<T>`、`PageResponse<T>`、`PageWrapper`
- Query 对象使用 `@QueryField` + `Operation` 描述查询条件
- Mapper 接口继承 `BaseMapperExtend<T>`
- 自定义分页 SQL 通过 MyBatis XML 编写
- 实体可能继承基础实体类，如 `BaseEntity`
- 敏感字段可使用 `@Encrypt`、`@WebSecuritySerialize`
- 业务异常通过 `BusinessException` 抛出
- 可能需要用 `@DubboService` 暴露接口能力

## 建议的落地顺序

如果任务是“根据文档实现后端功能”，优先按下面顺序生成或修改代码：

1. 明确接口和字段
2. 新增或修改 `Entity`
3. 新增或修改 `DTO`
4. 新增或修改 `Query`
5. 新增或修改 `Mapper`
6. 如有复杂查询，补 `mapper XML`
7. 新增或修改 `Service`
8. 新增或修改 `ServiceImpl`
9. 新增或修改 `Controller`
10. 最后检查配置、异常、国际化、Dubbo 暴露是否需要补齐

## 文档提炼清单

阅读文档时，至少提炼出这些内容：

- 要开发什么接口或服务
- 接口入参与出参
- 接口路径是否需要遵循 RESTful 资源设计
- 涉及哪些表和字段
- 哪些字段适合抽成枚举，取值定义是否明确
- 哪些字段可查询、查询方式是什么
- 是否需要自定义分页查询
- 哪些字段需要加密或脱敏
- 哪些字段需要参数校验、校验分组是什么
- 是否有国际化错误提示
- 是否有统一异常约定
- 是否要兼容已有 API 或 Dubbo 接口
- 是否依赖当前用户、租户或组织上下文，入口是否保证已经登录

## 输出模式

根据用户意图，选择一种输出方式。

### 1. 方案模式

适用于用户先要分析、任务拆解、开发计划。

输出应包含：
- 文档目标摘要
- 需要新增或修改的类
- 每层职责映射
- 风险点和缺失信息
- 实施步骤

### 2. 脚手架模式

适用于用户想先生成代码骨架。

输出应包含：
- 推荐文件结构
- 主要类和方法签名
- 与文档对应的字段和注解
- 留空处只保留真正需要人工确认的部分

### 3. 实现模式

适用于用户要求直接完成代码。

输出应包含：
- 按既有工程风格完成的代码修改
- 文档要求与代码实现的映射说明
- 做过的假设
- 验证结果

## 响应模板

必要时用下面这个结构输出：

### 文档结论
- 文档要求实现什么
- 关键约束是什么
- 验收点是什么

### 代码映射
- 接口 -> Controller
- 业务 -> Service / ServiceImpl
- 持久化 -> Mapper / XML
- 数据对象 -> Entity / DTO / Query

### 假设与缺口
- 哪些是文档明确给出的
- 哪些是参考样例推断出的
- 哪些信息缺失但不阻塞继续开发

### 结果
- 已完成的实现或计划
- 未完成项
- 验证情况

## 示例触发语句

- `帮我从零创建一个 FastDev 风格的 Spring Cloud 项目`
- `根据开发文档，在 demo-server 这种风格里新增一个用户列表分页接口`
- `参考现有样例和接口说明，帮我补齐 entity、dto、query、mapper、service、controller`
- `按照后端规范文档，把这个需求拆成 fastdev 项目的开发任务`
- `根据字段说明，给手机号做传输加密和响应脱敏`
- `按照后端规范给新增接口补齐参数校验，名称只能中文英文数字下划线，手机号要校验格式`
- `根据这张 user_info 表的表结构，帮我生成完整 CRUD，里面的 status 和 user_type 字段请按规范抽成枚举类`
- `按 RESTful 规范给这张表生成 CRUD 接口，路径和命名不要出现 add、update 这种动作词`
- `这个模块继承 BaseController4DTO 就行，只额外帮我补一个自定义分页查询接口，其他简单 CRUD 不要重复写`
- `这个模块的 Service 直接继承 BaseService4DTO，基础增删改查和基础分页不要重复定义，只补一个带联表条件的自定义分页查询`
- `根据表 agi_agent_charging 生成相关类，命名要按团队规范处理，尽量去掉统一前缀后再生成类名，同时包路径要直接沿用当前工程风格`
- `新增一个只有租户管理员能调用的接口，从 UserContext 获取 tenantId 和 userId，并兼容未登录场景`

## 缺失信息处理

如果文档不完整：

- 对于可以从样例稳定推断出来的部分，直接沿用既有模式。
- 对于会影响接口契约、数据库字段、加密算法、RPC 暴露方式的部分，先确认再写。
- 只问最关键的一个问题，不要连环追问。

## 质量标准

一个好的结果应当满足：

- 能明显看出是根据文档和样例工程产出的
- 分层结构符合现有项目习惯
- 没有凭空新增无依据的规则或字段
- 代码尽量少但完整可落地
- 用户能直接继续开发、联调或评审
