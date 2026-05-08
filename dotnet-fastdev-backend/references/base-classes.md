# Base Classes and Infrastructure

在 Newland.Furion.SqlSugar.Template 工程里，先判断基础类已经覆盖了什么，再决定要不要补代码。

## DBEntityBase

`DBEntityBase` 是实体基类，内置以下字段：

- `Id`（long）：主键，自增
- `CreateTime`（DateTime）：创建时间
- `UpdateTime`（DateTime）：更新时间

使用规则：

- 所有 Entity 继承 `DBEntityBase`
- 不需要重复声明 Id、CreateTime、UpdateTime 字段
- 如果需要自定义主键类型，可在子类使用 `virtual` 重写

示例：

```csharp
[SugarTable("user")]
public class User : DBEntityBase
{
    [SugarColumn(ColumnDataType = "varchar(255)", IsNullable = false)]
    public string Name { get; set; } = "";
}
```

## IDynamicApiController

`IDynamicApiController` 是动态 API 控制器接口，实现后会自动：

- 注册为 API 控制器
- 生成 Swagger 文档
- 自动配置路由（方法名即为路径）

使用规则：

- 所有 Controller 实现 `IDynamicApiController`
- 不需要继承 `ControllerBase`（除非有特殊需求）
- 使用 primary constructor 注入 Service
- 需要匿名访问的方法使用 `[AllowAnonymous]`
- 使用 `[ApiDescriptionSettings]` 配置 Swagger 信息

示例：

```csharp
[ApiDescriptionSettings(Name = "User", Order = 99, Tag = "用户服务")]
public class UserController(IUserService service) : IDynamicApiController
{
    private readonly IUserService _service = service;

    [AllowAnonymous]
    public async Task<long> Register(RegisterInput input)
    {
        return await _service.Register(input);
    }
}
```

## ITransient

`ITransient` 是瞬时生命周期接口，继承后服务会自动注册为 DI 服务。

使用规则：

- Service 接口继承 `ITransient`
- 不需要手动在 `Startup.cs` 注册服务
- 每次请求都会创建新的实例

示例：

```csharp
public interface IUserService : ITransient
{
    Task<long> Register(RegisterInput input);
}
```

其他生命周期接口：

- `ISingleton` - 单例（全局唯一实例）
- `IScope` - 作用域（每个请求一个实例）
- `ITransient` - 瞬时（每次获取创建新实例）

## SqlSugarRepository

`SqlSugarRepository<TEntity>` 是 SqlSugar ORM 仓储类，提供：

查询：
- `ToListAsync()` - 获取全部
- `ToListAsync(expression)` - 条件查询
- `FirstOrDefaultAsync(expression)` - 获取第一条
- `AnyAsync(expression)` - 检查是否存在
- `CountAsync(expression)` - 获取总数
- `SingleAsync(expression)` - 获取单个

新增：
- `InsertAsync(entity)` - 新增
- `InsertReturnIdentityAsync(entity)` - 新增返回自增 Id
- `InsertReturnSnowflakeIdAsync(entity)` - 新增返回雪花 Id

更新：
- `UpdateAsync(entity)` - 更新实体
- `UpdateAsync(predicate, content)` - 条件更新

删除：
- `DeleteAsync(entity)` - 删除实体
- `DeleteAsync(key)` - 按主键删除
- `DeleteAsync(expression)` - 条件删除

使用规则：

- 通过构造函数注入：`SqlSugarRepository<TEntity> _repository`
- 优先使用异步方法
- 查询使用 Lambda 表达式构建条件

示例：

```csharp
public class UserService : IUserService
{
    private readonly SqlSugarRepository<User> _repository;
    
    public UserService(SqlSugarRepository<User> repository)
    {
        _repository = repository;
    }
    
    public async Task<List<User>> GetAllAsync()
    {
        return await _repository.ToListAsync();
    }
}
```

## SqlSugarHelper

`SqlSugarHelper` 是静态帮助类，提供简化的 SqlSugar 操作。

常用方法：

- `SqlSugarHelper.Queryable<T>()` - 查询
- `SqlSugarHelper.UpdateAsync(entity)` - 更新
- `SqlSugarHelper.DeleteAsync(entity)` - 删除
- `SqlSugarHelper.InsertReturnIdentityAsync(entity)` - 新增返回 Id

使用规则：

- 不需要注入，直接静态调用
- 适合简单操作
- 复杂操作优先注入 `SqlSugarRepository`

示例：

```csharp
var exists = await SqlSugarHelper.Queryable<User>().AnyAsync(x => x.PhoneNumber == phone);
await SqlSugarHelper.InsertReturnIdentityAsync(user);
await SqlSugarHelper.UpdateAsync(user);
await SqlSugarHelper.DeleteAsync(user);
```

## AppUser

`AppUser` 是静态用户上下文类，用于获取当前登录用户信息。

可用属性：

- `AppUser.UserId` - 用户 ID
- `AppUser.PhoneNumber` - 手机号码

使用规则：

- 需要用户 ID 时使用 `AppUser.UserId`
- 需要用户手机号时使用 `AppUser.PhoneNumber`
- 静态类，直接调用即可

示例：

```csharp
public async Task<User> GetCurrentUser()
{
    var userId = AppUser.UserId;
    return await _repository.FirstOrDefaultAsync(x => x.Id.ToString() == userId);
}
```

## Exception Handling

使用 `Oops.Bah("message")` 抛出业务异常。

特点：

- Furion 框架提供的友好异常
- 自动返回统一的错误响应
- 支持国际化消息

使用规则：

- 业务异常使用 `throw Oops.Bah("message")`
- 不要直接抛 `throw new Exception()`
- 异常消息应清晰描述问题

示例：

```csharp
if (await SqlSugarHelper.Queryable<User>().AnyAsync(x => x.PhoneNumber == phone))
{
    throw Oops.Bah($"该手机号{phone}已被注册");
}

var user = await _repository.FirstOrDefaultAsync(x => x.Id == id);
if (user == null)
{
    throw Oops.Bah("该用户不存在");
}
```

## Data Encryption

使用 `MD5Encryption.Encrypt()` 加密数据。

示例：

```csharp
user.Password = MD5Encryption.Encrypt(input.Password);
```

其他加密方法（根据需要选择）：

- `MD5Encryption.Encrypt()` - MD5 加密
- 其他加密方法参考 Newland.AspNetCore.DataEncryption

## Startup Configuration

`Startup.cs` 配置服务：

- JWT 认证：`services.AddJwt<JwtHandler>(enableGlobalAuthorize: true)`
- 跨域：`services.AddCorsAccessor()`
- 控制器：`services.AddControllers()`
- SqlSugar：`services.SqlSugarScopeConfigure()`

## ClaimConst

`ClaimConst` 定义 JWT Claims 常量：

- `ClaimConst.UserId` - 用户 ID Claim
- `ClaimConst.PhoneNumber` - 手机号码 Claim

## Response Wrapper

Furion 框架自动包装返回值为统一响应格式。

规则：

- 直接返回数据对象，框架自动包装
- 不需要手动创建 `Result<T>` 类型
- 异常会自动转换为错误响应

示例：

```csharp
// 直接返回数据
public async Task<long> Register(RegisterInput input)
{
    return await _service.Register(input);
}

// 框架自动包装为：
// {
//   "success": true,
//   "data": 123,
//   "message": null
// }
```

## Dependency Injection

依赖注入规则：

- Service 接口继承 `ITransient` 自动注册
- Controller 使用 primary constructor 注入
- Repository 使用构造函数注入

示例：

```csharp
// Service 接口
public interface IUserService : ITransient { }

// Service 实现
public class UserService : IUserService
{
    private readonly SqlSugarRepository<User> _repository;
    
    public UserService(SqlSugarRepository<User> repository)
    {
        _repository = repository;
    }
}

// Controller
public class UserController(IUserService service) : IDynamicApiController
{
    private readonly IUserService _service = service;
}
```

## When To Read This File

- 涉及 Entity 设计时
- 涉及 Controller 设计时
- 涉及 Service 设计时
- 涉及用户上下文获取时
- 涉及异常处理时
- 涉及数据加密时