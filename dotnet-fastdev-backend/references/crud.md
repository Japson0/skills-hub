# CRUD And Pagination

## Single-Table CRUD

当用户要求"对某张表做 CRUD"时，先要求用户提供表结构。

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

如果任务是"根据单表结构快速生成 CRUD"，优先按下面顺序处理：

1. 获取表结构，至少包括表名、主键、字段名、类型、含义、是否必填
2. 识别字段中哪些属于枚举语义，例如状态、类型、来源、级别
3. 优先定义枚举类（在 Core/Enum 目录），再生成 Entity、Input/DTO、Service、Controller
4. Entity 继承 DBEntityBase，使用 `[SugarTable]` 和 `[SugarColumn]` 特性
5. Service 接口继承 `ITransient`，实现类注入 `SqlSugarRepository<TEntity>` 或使用 `SqlSugarHelper`
6. Controller 实现 `IDynamicApiController`，使用 `[ApiDescriptionSettings]` 特性
7. 最后再决定是否需要补新增、修改、删除、详情、分页查询接口

## Entity Design

Entity 应继承 `DBEntityBase`，使用 SqlSugar 特性：

```csharp
[SugarTable("user")]
public class User : DBEntityBase
{
    [SugarColumn(ColumnDataType = "varchar(255)", IsNullable = false)]
    public string Name { get; set; } = "";

    [SugarColumn(ColumnDataType = "varchar(255)", IsNullable = false)]
    public string PhoneNumber { get; set; } = "";

    [SugarColumn(ColumnDataType = "datetime", IsNullable = true)]
    public DateTime LastLoginTime { get; set; }
}
```

Entity 规则：

- 继承 `DBEntityBase` 获得 Id、CreateTime、UpdateTime 字段
- 使用 `[SugarTable("table_name")]` 指定表名
- 使用 `[SugarColumn]` 指定列数据类型、是否可空
- 字段使用 `get; set;` 属性，字符串字段初始化为空字符串 `""`
- 不要使用可为空类型（如 `string?`），除非明确要求

## Service Pattern

Service 接口应继承 `ITransient`（依赖注入生命周期）：

```csharp
public interface IUserService : ITransient
{
    Task<long> Register(RegisterInput input);
    Task<long> Update(UpdateUserInput input);
    Task Delete(long UserId);
}
```

Service 实现类：

```csharp
public class UserService : IUserService
{
    // 方式1：使用 SqlSugarHelper（简化操作）
    public async Task<long> Register(RegisterInput input)
    {
        if (await SqlSugarHelper.Queryable<User>().AnyAsync(x => x.PhoneNumber.Equals(input.PhoneNumber)))
        {
            throw Oops.Bah($"该手机号{input.PhoneNumber}已被注册");
        }
        
        User user = new User();
        user.PhoneNumber = input.PhoneNumber;
        user.Name = input.Name;
        user.Password = MD5Encryption.Encrypt(input.Password);
        
        return await SqlSugarHelper.InsertReturnIdentityAsync(user);
    }

    // 方式2：注入 SqlSugarRepository（更灵活）
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

Service 规则：

- 接口继承 `ITransient`（瞬时生命周期）
- 使用构造函数注入 `SqlSugarRepository<TEntity>` 或使用 `SqlSugarHelper`
- 查询优先使用异步方法（`ToListAsync`、`AnyAsync`、`FirstAsync`）
- 新增返回自增 Id 使用 `InsertReturnIdentityAsync`
- 数据加密使用 `MD5Encryption.Encrypt()`
- 业务异常使用 `throw Oops.Bah("message")`

## SqlSugarHelper Methods

常用方法：

- `SqlSugarHelper.Queryable<T>()` - 查询
- `SqlSugarHelper.UpdateAsync(entity)` - 更新
- `SqlSugarHelper.DeleteAsync(entity)` - 删除
- `SqlSugarHelper.InsertReturnIdentityAsync(entity)` - 新增返回自增 Id

查询方法：

- `.Where(expression)` - 条件查询
- `.AnyAsync(expression)` - 检查是否存在
- `.FirstAsync(expression)` - 获取第一条
- `.ToListAsync()` - 获取列表
- `.OrderBy(expression)` - 排序

## SqlSugarRepository Methods

注入 `SqlSugarRepository<TEntity>` 后可用方法：

查询：
- `ToListAsync()` - 获取全部列表
- `ToListAsync(expression)` - 条件查询
- `FirstOrDefaultAsync(expression)` - 获取第一条
- `AnyAsync(expression)` - 检查是否存在
- `CountAsync(expression)` - 获取总数
- `SingleAsync(expression)` - 获取单个

新增：
- `InsertAsync(entity)` - 新增一条
- `InsertAsync(entities)` - 新增多条
- `InsertReturnIdentityAsync(entity)` - 新增返回自增 Id
- `InsertReturnSnowflakeIdAsync(entity)` - 新增返回雪花 Id
- `InsertReturnEntityAsync(entity)` - 新增返回实体

更新：
- `UpdateAsync(entity)` - 更新一条
- `UpdateAsync(entities)` - 更新多条
- `UpdateAsync(predicate, content)` - 条件更新

删除：
- `DeleteAsync(entity)` - 删除实体
- `DeleteAsync(key)` - 按主键删除
- `DeleteAsync(expression)` - 条件删除

## Controller Pattern

Controller 实现 `IDynamicApiController`：

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

    public async Task<long> Update(UpdateUserInput input)
    {
        return await _service.Update(input);
    }

    public async Task Delete(long UserId)
    {
        await _service.Delete(UserId);
    }
}
```

Controller 规则：

- 实现 `IDynamicApiController` 自动注册为 API 控制器
- 使用 `[ApiDescriptionSettings]` 配置 Swagger 分组和标签
- 使用 primary constructor 注入 Service：`public class UserController(IUserService service)`
- 需要匿名访问的方法使用 `[AllowAnonymous]` 特性
- 方法名直接作为 API 路径（如 `Register` -> `/api/User/Register`）
- 返回值直接返回数据对象，框架自动包装为统一响应

## Paging Rules

- 分页接口不默认创建
- 只有在用户明确要求"分页查询"时，才补分页接口
- 使用 SqlSugar 的分页查询方法：

```csharp
public async Task<PageResult<UserDto>> GetPage(int pageIndex, int pageSize, string? name)
{
    var query = SqlSugarHelper.Queryable<User>();
    
    if (!string.IsNullOrEmpty(name))
    {
        query = query.Where(x => x.Name.Contains(name));
    }
    
    var page = await query.ToPageListAsync(pageIndex, pageSize);
    var totalCount = await query.CountAsync();
    
    return new PageResult<UserDto>
    {
        Items = page.Adapt<List<UserDto>>(),
        TotalCount = totalCount,
        PageIndex = pageIndex,
        PageSize = pageSize
    };
}
```

## Query Object Rules

可以使用条件表达式构建查询：

```csharp
// 简单条件
await _repository.Where(x => x.Name.Contains(keyword)).ToListAsync();

// 多条件组合
await _repository.Where(x => 
    x.Status == status && 
    x.CreateTime >= startTime && 
    x.CreateTime <= endTime
).ToListAsync();

// 排序查询
await _repository.ToListAsync(
    x => x.Status == 1,
    x => x.CreateTime,
    OrderByType.Desc
);
```

## DTO And Input Pattern

Input 用于接收请求参数：

```csharp
public class RegisterInput
{
    public string Name { get; set; } = "";

    [DataValidation(DataValidationTypeEnum.PhoneNumberValidate), Required]
    public string PhoneNumber { get; set; } = "";

    [MinLength(6), MaxLength(32), Required]
    public string Password { get; set; } = "";
}
```

DTO 用于返回数据：

```csharp
public class UserDto
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string PhoneNumber { get; set; } = "";
    public DateTime CreateTime { get; set; }
}
```

可以使用 Mapster 进行对象映射：

```csharp
var dto = entity.Adapt<UserDto>();
var dtos = entities.Adapt<List<UserDto>>();
```

## Rules

- Controller 保持路径、命名风格与现有模块一致
- 返回值直接返回数据对象，框架自动包装
- Service 接口只暴露必要方法，不堆砌重复 CRUD
- 业务异常使用 `Oops.Bah("message")`
- 数据加密使用 `MD5Encryption.Encrypt()`
- 查询优先使用异步方法
- 复杂查询使用条件表达式构建