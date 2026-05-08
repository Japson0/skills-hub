# Naming Conventions

## Table Name to Entity Name

表名转换为实体类名规则：

- 表名使用下划线命名：`user_info`
- 实体类名使用 PascalCase：`UserInfo`
- 去除常见前缀：`tb_user` → `User`
- 去除下划线，首字母大写：`sys_config` → `SysConfig`

示例：

| 表名 | 实体类名 |
|------|----------|
| `user` | `User` |
| `user_info` | `UserInfo` |
| `sys_config` | `SysConfig` |
| `sys_operate_log` | `SysOperateLog` |
| `tb_order` | `Order` |

## Project Layers Naming

四层架构命名规范：

### Core Layer（基础设施层）

- 项目名：`{ProjectName}.Core`
- 目录：
  - `SqlSugar/` - ORM 配置
  - `Const/` - 常量
  - `Enum/` - 枚举
  - 文件：`AppUser.cs` - 用户上下文

### Application Layer（业务逻辑层）

- 项目名：`{ProjectName}.Application`
- 目录：
  - `Entity/` - 实体类
  - `Services/` - 业务服务
    - `{ModuleName}/` - 模块目录（如 `User/`、`Auth/`）
- 命名：
  - Entity：`{TableName}`（如 `User.cs`）
  - Service 接口：`I{ModuleName}Service`（如 `IUserService.cs`）
  - Service 实现：`{ModuleName}Service`（如 `UserService.cs`）
  - Input/DTO：`{Action}Input` / `{ModuleName}Dto`（如 `RegisterInput.cs`、`UserDto.cs`）

### Web.Core Layer（控制器层）

- 项目名：`{ProjectName}.Web.Core`
- 目录：
  - `Controllers/` - API 控制器
  - `Handlers/` - 处理器
  - 文件：`Startup.cs` - 启动配置
- 命名：
  - Controller：`{ModuleName}Controller`（如 `UserController.cs`）
  - Handler：`{Purpose}Handler`（如 `JwtHandler.cs`）

### Web.Entry Layer（入口层）

- 项目名：`{ProjectName}.Web.Entry`
- 文件：
  - `Program.cs` - 应用入口
  - `appsettings.json` - 配置文件
  - `appsettings.Development.json` - 开发环境配置

## Namespace Conventions

命名空间规则：

- Core：`{ProjectName}.Core`
- Application：`{ProjectName}.Application`
- Entity：`{ProjectName}.Application.Entity`
- Service：`{ProjectName}.Application`
- Web.Core：`{ProjectName}.Web.Core`
- Controller：`{ProjectName}.Web.Core`

示例：

```csharp
// Entity
namespace MyProject.Application.Entity;

// Service Interface
namespace MyProject.Application;

// Service Implementation
namespace MyProject.Application;

// Controller
namespace MyProject.Web.Core;

// Core utilities
namespace MyProject.Core;
```

## RESTful Path Naming

API 路径命名规则：

- Controller 类名：`UserController` → 路径：`/api/User`
- 方法名直接作为子路径：
  - `Register()` → `/api/User/Register`
  - `Update()` → `/api/User/Update`
  - `Delete()` → `/api/User/Delete`
  - `GetList()` → `/api/User/GetList`
  - `GetPage()` → `/api/User/GetPage`

RESTful 命名建议：

| 操作 | 建议方法名 | 路径 |
|------|-----------|------|
| 新增 | `Create` / `Register` / `Add` | POST `/api/User/Create` |
| 更新 | `Update` / `Edit` | POST `/api/User/Update` |
| 删除 | `Delete` / `Remove` | POST `/api/User/Delete` |
| 列表 | `GetList` / `GetAll` | GET `/api/User/GetList` |
| 详情 | `Get` / `GetById` / `GetDetail` | GET `/api/User/Get?id=1` |
| 分页 | `GetPage` / `GetPagedList` | GET `/api/User/GetPage?pageIndex=1&pageSize=10` |

避免的动作词：

- 不使用 `doXxx`、`executeXxx`
- 不使用过于通用的 `handleXxx`

## Enum Naming

枚举命名规则：

- 文件位置：`Core/Enum/`
- 类名使用 PascalCase：`StatusEnum`、`UserTypeEnum`
- 枚举值使用 PascalCase：`Active`、`Inactive`
- 文件名：`{Purpose}Enum.cs`

示例：

```csharp
namespace MyProject.Core.Enum;

public enum StatusEnum
{
    Active = 1,
    Inactive = 0
}

public enum UserTypeEnum
{
    Admin = 1,
    Normal = 2,
    Guest = 3
}
```

## Constant Naming

常量命名规则：

- 文件位置：`Core/Const/`
- 类名：`{Purpose}Const`
- 常量名：UPPER_CASE
- 文件名：`{Purpose}Const.cs`

示例：

```csharp
namespace MyProject.Core.Const;

public static class ClaimConst
{
    public const string UserId = "userId";
    public const string PhoneNumber = "phoneNumber";
}
```

## Service Interface Naming

Service 接口命名规则：

- 接口名：`I{ModuleName}Service`
- 文件名与接口名一致：`IUserService.cs`
- 放在 `Application/Services/{ModuleName}/` 目录

示例：

```csharp
// IUserService.cs
namespace MyProject.Application;

public interface IUserService : ITransient
{
    Task<long> Register(RegisterInput input);
    Task Delete(long userId);
}
```

## DTO And Input Naming

DTO/Input 命名规则：

- Input（请求参数）：`{Action}Input`
  - `RegisterInput` - 注册输入
  - `UpdateUserInput` - 更新用户输入
  - `LoginInput` - 登录输入
  
- DTO（返回数据）：`{ModuleName}Dto` 或 `{Purpose}Dto`
  - `UserDto` - 用户数据
  - `UserDetailDto` - 用户详情
  - `LoginResultDto` - 登录结果

- 文件位置：与 Service 放在同一目录

示例：

```csharp
// RegisterInput.cs
namespace MyProject.Application;

public class RegisterInput
{
    public string Name { get; set; } = "";
    public string PhoneNumber { get; set; } = "";
}

// UserDto.cs
namespace MyProject.Application;

public class UserDto
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
}
```

## Swagger Tag Naming

Swagger 标签命名规则：

- 使用 `[ApiDescriptionSettings]` 特性
- Name：Controller 名（去掉 "Controller"）
- Tag：中文描述或业务分组名
- Order：分组排序（越小越靠前）

示例：

```csharp
[ApiDescriptionSettings(Name = "User", Order = 99, Tag = "用户服务")]
public class UserController : IDynamicApiController { }

[ApiDescriptionSettings(Name = "Auth", Order = 1, Tag = "认证服务")]
public class AuthController : IDynamicApiController { }
```

## Common Prefixes to Remove

常见表名前缀应去除：

- `tb_` → 去除
- `t_` → 去除
- `sys_` → 保留（系统模块）
- `app_` → 保留（应用模块）
- `biz_` → 保留（业务模块）

示例：

| 表名 | Entity 类名 |
|------|-------------|
| `tb_user` | `User` |
| `t_order` | `Order` |
| `sys_config` | `SysConfig` |
| `app_setting` | `AppSetting` |

## When To Read This File

- 涉及 Entity 类名设计时
- 涉及 Service 接口命名时
- 涉及 Controller 命名时
- 涉及 API 路径设计时
- 涉及枚举、常量命名时
- 涉及 DTO/Input 命名时