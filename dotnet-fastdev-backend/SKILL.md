---
name: dotnet-fastdev-backend
description: Use this skill whenever the user wants to implement, scaffold, or plan a backend feature in a .NET Furion + SqlSugar layered architecture project. Trigger whenever the request involves creating entities, services, controllers, DTOs, CRUD operations, pagination, validation, JWT authentication, or following existing module patterns. Use it even if the user only says things like "根据表结构生成CRUD", "帮我写一个API接口", "参考现有模块生成代码", "创建新的业务模块", or "按模板规范开发" without explicitly asking for a skill.
---

# .NET Furion + SqlSugar Fast Development

这个 skill 用来基于 Newland.Furion.SqlSugar.Template 模板快速开发 .NET 后端功能。

目标不是"凭空生成一套代码"，而是先读文档和现有样例，再严格套用项目里已经存在的开发模式，输出可以直接落地的实现、脚手架或者任务拆解。

## 参考文件

根据任务类型按需读取这些文件，不需要每次都展开全部细则：

- `references/project-init.md`
  适用于从零初始化基于 Newland.Furion.SqlSugar.Template 的新项目
- `references/crud.md`
  适用于单表 CRUD、分页、自定义查询、SqlSugar Repository 使用
- `references/base-classes.md`
  适用于 DBEntityBase、IDynamicApiController、ITransient、SqlSugarRepository、AppUser、异常处理
- `references/naming.md`
  适用于表名转类名、项目分层命名、RESTful 路径命名、命名空间规范
- `references/validation.md`
  适用于参数校验、DataValidation 特性、输入 DTO 验证规则

## 适用场景

当用户提出以下类型的需求时使用这个 skill：

- 根据需求文档或接口文档开发一个 .NET Web API 接口
- 从零初始化一个符合 Newland.Furion.SqlSugar.Template 风格的新项目
- 根据单表结构快速生成 CRUD 模块（Entity/Service/Controller/DTO）
- 根据现有样例模块，生成同风格的增删改查代码
- 根据开发规范文档，补齐 Entity、Service、Controller、DTO
- 根据字段说明实现分页查询、条件查询
- 根据开发文档先产出任务拆解或实施方案，再决定是否写代码
- 配置 JWT 认证、Swagger 文档、数据库连接
- 实现参数验证、数据加密、异常处理

如果只是泛泛地讨论方案，没有实际文档，也没有要求遵循现有工程风格，就不要使用这个 skill。

## 先做什么

收到任务后，先不要急着写代码。按下面顺序执行：

1. 如果任务是从零创建项目，确认是否应使用 `dotnet new nl-furion-sqlsugar` 命令初始化
2. 找到并阅读开发文档、接口文档、样例代码、模块结构
3. 如果任务是针对某张表生成 CRUD，先确认用户已提供表结构；没有表结构时，不要臆造字段
4. 确认这是在现有 Newland.Furion.SqlSugar.Template 风格工程上继续开发，而不是另起一套架构
5. 提炼下面这些信息：
   - 功能目标
   - 请求路径和请求方式
   - 入参结构（Input/DTO）
   - 返回结构
   - 数据表或实体字段
   - 查询条件和分页要求
   - 是否需要 JWT 认证
   - 是否涉及数据加密、业务异常、参数验证
   - 验收条件
6. 区分清楚：
   - 文档明确写出的事实
   - 根据现有样例做出的合理推断
   - 文档缺失但会影响正确性的关键信息
7. 如果缺失信息会影响接口行为、表结构、加密方式或服务边界，先问一个简短问题；否则按最小正确实现继续。

## 核心原则

- 优先遵循文档和现有代码样例，不要擅自设计一套新分层
- 如果任务是初始化新项目，优先使用 `dotnet new nl-furion-sqlsugar` 命令
- 优先复用项目里的基础能力，例如 DBEntityBase、SqlSugarRepository、IDynamicApiController、ITransient
- 能复用已有模式就不要重复发明辅助类
- 文档没写清楚时，不要凭空虚构字段、错误码、业务规则
- 如果文档和样例冲突，先指出冲突，再按用户意图决定跟文档还是跟现有代码

## 按场景读取

- 如果任务涉及项目初始化、模板安装、参数配置，读取 `references/project-init.md`
- 如果任务涉及单表 CRUD、分页、SqlSugar 查询、Repository 使用，读取 `references/crud.md`
- 如果任务涉及基类复用、依赖注入、用户上下文、异常处理，读取 `references/base-classes.md`
- 如果任务涉及类名推导、表名处理、命名空间、RESTful 命名，读取 `references/naming.md`
- 如果任务涉及参数校验、DataValidation 特性、输入验证规则，读取 `references/validation.md`

## 识别这个工程的典型模式

当你在类似以下结构的 .NET 工程里工作时，优先延续这些模式：

### 四层架构

- `Core` 层：基础设施、SqlSugar 配置、常量、枚举、用户上下文助手
- `Application` 层：业务逻辑、Entity、Service、DTO
- `Web.Core` 层：控制器、JWT 处理器、Startup 配置
- `Web.Entry` 层：应用入口、配置文件、环境设置

### 典型开发习惯

- Entity 继承 `DBEntityBase`，使用 `[SugarTable]` 和 `[SugarColumn]` 特性
- Service 接口继承 `ITransient`（依赖注入生命周期）
- Service 实现类注入 `SqlSugarRepository<TEntity>` 或使用 `SqlSugarHelper`
- Controller 实现 `IDynamicApiController`，使用 `[ApiDescriptionSettings]` 特性
- 需要匿名访问的方法使用 `[AllowAnonymous]` 特性
- 输入 DTO 使用 `[DataValidation]`、`[Required]`、`[MinLength]`、`[MaxLength]` 特性
- 数据加密使用 `MD5Encryption.Encrypt()` 等方法
- 业务异常使用 `Oops.Bah("message")` 抛出
- 用户上下文通过 `AppUser.UserId`、`AppUser.PhoneNumber` 获取
- 返回值直接返回数据对象，框架自动包装为统一响应

## 建议的落地顺序

如果任务是"根据文档实现后端功能"，优先按下面顺序生成或修改代码：

1. 明确接口和字段
2. 新增或修改 `Entity`（Application/Entity）
3. 新增或修改 `Input/DTO`（Application/Services/{Module})
4. 新增或修改 `IService` 接口（Application/Services/{Module})
5. 新增或修改 `Service` 实现类（Application/Services/{Module})
6. 新增或修改 `Controller`（Web.Core/Controllers）
7. 最后检查配置、异常、验证、JWT 是否需要补齐

## 文档提炼清单

阅读文档时，至少提炼出这些内容：

- 要开发什么接口或服务
- 接口入参与出参
- 接口路径是否需要遵循 RESTful 资源设计
- 涉及哪些表和字段
- 哪些字段适合抽成枚举，取值定义是否明确
- 哪些字段可查询、查询方式是什么
- 是否需要分页查询
- 哪些字段需要加密或脱敏
- 哪些字段需要参数校验、校验规则是什么
- 是否有统一异常约定
- 是否需要 JWT 认证，是否允许匿名访问

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
- 与文档对应的字段和特性
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
- 业务 -> Service
- 持久化 -> SqlSugarRepository / SqlSugarHelper
- 数据对象 -> Entity / Input / DTO

### 假设与缺口
- 哪些是文档明确给出的
- 哪些是参考样例推断出的
- 哪些信息缺失但不阻塞继续开发

### 结果
- 已完成的实现或计划
- 未完成项
- 验证情况

## 示例触发语句

- `帮我创建一个基于 Newland.Furion.SqlSugar.Template 的 .NET 项目`
- `根据开发文档，在 MyProject 项目里新增一个用户管理 API`
- `参考现有样例，帮我补齐 Entity、Service、Controller、DTO`
- `按照模板规范，把这个需求拆成开发任务`
- `根据这张 user 表的表结构，帮我生成完整 CRUD`
- `按 RESTful 规范给这张表生成 CRUD 接口`
- `这个模块的 Service 需要实现用户注册、更新、删除功能`
- `根据表结构生成实体类，字段命名要遵循 C# 规范`
- `给新增接口补齐参数校验，名称不能为空，手机号要校验格式`
- `这个接口需要匿名访问，不要求 JWT 认证`

## 缺失信息处理

如果文档不完整：

- 对于可以从样例稳定推断出来的部分，直接沿用既有模式
- 对于会影响接口契约、数据库字段、加密算法、认证方式的部分，先确认再写
- 只问最关键的一个问题，不要连环追问

## 质量标准

一个好的结果应当满足：

- 能明显看出是根据文档和样例工程产出的
- 分层结构符合现有项目习惯（Core/Application/Web.Core/Web.Entry）
- 没有凭空新增无依据的规则或字段
- 代码尽量少但完整可落地
- 用户能直接继续开发、联调或评审

## 项目模板使用

Skill 内置 NuGet 模板包：`nupkg/Newland.Furion.SqlSugar.Template.1.0.0.nupkg`

### 安装模板

```bash
# 使用 skill 内置模板包安装
dotnet new install ./nupkg/Newland.Furion.SqlSugar.Template.1.0.0.nupkg

# 或者从内部 NuGet 仓库下载安装（网络环境允许时）
curl -o template.nupkg \
  http://192.168.133.170:5000/download/Newland.Furion.SqlSugar.Template/1.0.0
dotnet new install template.nupkg
```

### 创建新项目

```bash
# 基本用法
dotnet new nl-furion-sqlsugar -n MyProjectName

# 自定义数据库类型
dotnet new nl-furion-sqlsugar -n MyProjectName --db-type SqlServer

# 自定义框架版本
dotnet new nl-furion-sqlsugar -n MyProjectName --framework net9.0
```

### 可用参数

| 参数 | 默认值 | 可选值 | 说明 |
|------|--------|--------|------|
| `-n` | 必填 | 任意名称 | 项目名称 |
| `--db-type` | MySql | MySql, SqlServer, PostgreSQL, Oracle, Sqlite | 数据库类型 |
| `--framework` | net8.0 | net8.0, net9.0 | 目标框架 |
| `--enable-swagger` | true | true, false | 启用 Swagger UI |
| `--no-restore` | false | true, false | 跳过 NuGet 还原 |

### 模板包位置

Skill 内置模板包位于：`dotnet-fastdev-backend/nupkg/Newland.Furion.SqlSugar.Template.1.0.0.nupkg`

使用时可直接引用该路径安装模板。