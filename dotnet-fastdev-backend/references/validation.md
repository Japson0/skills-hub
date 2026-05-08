# Validation and Data Validation

## Input Validation

Input 类使用 DataAnnotations 特性进行参数校验。

### 常用特性

- `[Required]` - 必填字段
- `[MinLength(n)]` - 最小长度
- `[MaxLength(n)]` - 最大长度
- `[Range(min, max)]` - 数值范围
- `[RegularExpression(pattern)]` - 正则表达式
- `[EmailAddress]` - 邮箱格式
- `[Phone]` - 电话号码格式
- `[Url]` - URL 格式

示例：

```csharp
public class RegisterInput
{
    /// <summary>
    /// 姓名
    /// </summary>
    public string Name { get; set; } = "";

    /// <summary>
    /// 手机号码
    /// </summary>
    [DataValidation(DataValidationTypeEnum.PhoneNumberValidate), Required]
    public string PhoneNumber { get; set; } = "";

    /// <summary>
    /// 密码
    /// </summary>
    [MinLength(6), MaxLength(32), Required]
    public string Password { get; set; } = "";
}
```

## DataValidation Feature

Newland.Furion 提供 `[DataValidation]` 特性用于自定义验证。

可用验证类型（`DataValidationTypeEnum`）：

- `PhoneNumberValidate` - 手机号码验证
- 其他类型参考 `Core/Enum/DataValidationTypeEnum.cs`

使用规则：

- 使用 `[DataValidation(DataValidationTypeEnum.Xxx)]`
- 结合 `[Required]` 确保必填
- Furion 框架会自动执行验证并返回错误信息

示例：

```csharp
[DataValidation(DataValidationTypeEnum.PhoneNumberValidate), Required]
public string PhoneNumber { get; set; } = "";
```

## String Validation

字符串验证规则：

```csharp
// 必填
[Required]
public string Name { get; set; } = "";

// 长度范围
[MinLength(2), MaxLength(50), Required]
public string Username { get; set; } = "";

// 固定长度
[StringLength(18)]
public string IdCard { get; set; } = "";

// 正则表达式（只允许中文、英文、数字）
[RegularExpression(@"^[a-zA-Z0-9\u4e00-\u9fa5]+$")]
public string DisplayName { get; set; } = "";
```

## Numeric Validation

数值验证规则：

```csharp
// 数值范围
[Range(0, 100)]
public int Score { get; set; }

// 正整数
[Range(1, int.MaxValue)]
public int Age { get; set; }

// 小数范围
[Range(0.0, 100.0)]
public decimal Price { get; set; }
```

## DateTime Validation

日期时间验证：

```csharp
// 未来日期验证（自定义逻辑）
public DateTime ExpireTime { get; set; }

// 在 Service 中验证
if (input.ExpireTime < DateTime.Now)
{
    throw Oops.Bah("过期时间不能早于当前时间");
}
```

## Enum Validation

枚举值验证：

```csharp
// 定义枚举
public enum StatusEnum
{
    Active = 1,
    Inactive = 0
}

// Input 中使用枚举
public StatusEnum Status { get; set; }

// 或使用数值范围验证
[Range(0, 1)]
public int Status { get; set; }
```

## Collection Validation

集合验证：

```csharp
// 集合最小数量
[MinLength(1)]
public List<string> Tags { get; set; } = new();

// 集合最大数量
[MaxLength(10)]
public List<int> Scores { get; set; } = new();
```

## Validation Groups

验证分组（用于不同场景的验证）：

```csharp
public class UserInput
{
    [Required]
    public string Name { get; set; } = "";

    // 创建时必填
    [Required(ErrorMessage = "创建时密码必填")]
    public string? Password { get; set; }

    // 更新时可选
    [EmailAddress]
    public string? Email { get; set; }
}
```

## Custom Validation Messages

自定义验证消息：

```csharp
[Required(ErrorMessage = "姓名不能为空")]
public string Name { get; set; } = "";

[MinLength(6, ErrorMessage = "密码至少6位")]
[MaxLength(32, ErrorMessage = "密码最多32位")]
public string Password { get; set; } = "";

[Range(1, 100, ErrorMessage = "年龄必须在1-100之间")]
public int Age { get; set; }
```

## Business Validation

业务逻辑验证在 Service 中实现：

```csharp
public async Task<long> Register(RegisterInput input)
{
    // 数据唯一性验证
    if (await SqlSugarHelper.Queryable<User>().AnyAsync(x => x.PhoneNumber.Equals(input.PhoneNumber)))
    {
        throw Oops.Bah($"该手机号{input.PhoneNumber}已被注册");
    }

    // 数据存在性验证
    var user = await _repository.FirstOrDefaultAsync(x => x.Id == input.UserId);
    if (user == null)
    {
        throw Oops.Bah("该用户不存在");
    }

    // 业务规则验证
    if (input.Age < 18)
    {
        throw Oops.Bah("未成年用户需监护人同意");
    }
    
    // 继续处理...
}
```

## Validation Priority

验证优先级：

1. DataAnnotations 特性验证（框架自动执行）
2. 自定义 `[DataValidation]` 特性验证
3. Service 中的业务逻辑验证

如果 DataAnnotations 验证失败，请求不会进入 Service 方法。

## Field Initialization

字段初始化规则：

- 字符串字段初始化为空字符串：`""`
- 不要使用 `string?`（可为空字符串），除非明确要求
- 集合字段初始化：`new List<T>()` 或 `new()`

示例：

```csharp
public class UserInput
{
    public string Name { get; set; } = "";
    public string PhoneNumber { get; set; } = "";
    public List<string> Tags { get; set; } = new();
}
```

## Error Response

验证失败时，框架自动返回错误响应：

```json
{
  "success": false,
  "message": "姓名不能为空",
  "errors": [
    "姓名不能为空",
    "密码至少6位"
  ]
}
```

## When To Read This File

- 涉及参数校验时
- 涉及 Input 类设计时
- 涉及数据验证规则时
- 涉及自定义验证时
- 涉及业务逻辑验证时