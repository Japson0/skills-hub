# Validation And Enum Rules

## Validation

如果任务涉及新增请求对象或接口入参校验，优先沿用框架内置的 validation 能力。

除了 Spring 常见注解如 `@NotNull`、`@NotEmpty`、`@Email` 外，还应识别并优先使用这些内置校验：

- `@General`：英文字母、数字和下划线
- `@GeneralWithChinese`：英文字母、中文、数字和下划线
- `@HttpUrl`：URL 地址校验
- `@IdCard`：身份证校验
- `@Ip`：IPV4 / IPV6 校验
- `@Phone`：手机号校验，当前主要适用于中国大陆

使用规则：

- 如果文档对字段格式有明确约束，优先选择最贴切的内置注解，而不是只写注释
- 对新增、修改等分场景校验，优先使用校验分组，如 `Insert.class`、`Update.class`
- Controller 层如采用自动校验，优先使用 `@Validated(Group.class) @RequestBody XxxReq`
- 如果当前接口不是自动校验链路，且样例允许手动校验，可使用 `ValidateUtils.validate(entity, Group.class)`
- 不要无依据地给所有字段都加校验，只为文档明确要求或业务上明显必要的字段补充

常见生成方式：

- 新增 `Req` / `Command` / `Form` 对象承载写接口参数
- 在字段上添加校验注解和自定义 message
- 在 Controller 方法参数上添加 `@Validated(...)`
- 如有必要，结合现有 `Insert`、`Update` 分组控制不同场景的校验逻辑

## Enum Rules

如果字段具备明确的离散取值语义，例如状态、类型、来源、性别、级别等，应优先定义枚举类，而不是在代码中直接散落 magic number 或 magic string。

枚举规则：

- 枚举类优先放在 `model/enums` 或项目既有枚举目录下
- 枚举类应继承或实现 `ComEnum<Integer>`
- 枚举值建议统一使用 `Integer`
- Entity、DTO、Query、Req 中能使用枚举类型时，优先直接使用枚举类型
- 只有在外部契约明确要求传原始数值时，才在边界层保留整数值表达
- 枚举命名要体现业务语义，不要使用弱语义名称

如果文档或表结构没有给出枚举取值说明，不要自行编造完整枚举项；可以先保留整数字段并向用户确认。

## Field Encryption Rules

如果字段需要加密存储或传输处理，优先沿用框架已有的加密能力，不要手写散落在业务代码里的加解密逻辑。

已知规则：

- 当实体存在需要加密的字段时，对应 `Entity` 应实现 `CryptAble` 作为标识
- 具体字段通过 `@Encrypt(EncryptType.XX)` 标注加密类型
- `@Encrypt` 可用于字段或参数

已知 `EncryptType`：

- `EncryptType.SM4`：对称算法，可解密
- `EncryptType.SM3`：摘要算法，不可解密

使用建议：

- 像 `password` 这类通常只需要摘要存储的字段，优先使用 `@Encrypt(EncryptType.SM3)`
- 像手机号这类既要保护数据、又可能存在解密或可逆处理需求的字段，可按现有规范使用 `@Encrypt(EncryptType.SM4)`
- 如果实体中存在任一加密字段，优先让该实体实现 `CryptAble`
- 不要把加密逻辑手写在 Controller 或 Service 里，优先通过实体标记和字段注解交给框架处理
- 如果字段同时涉及展示脱敏，可结合项目现有脱敏注解使用，例如 `@WebSecuritySerialize`

示例：

```java
public class UserEntity extends BaseEntity implements CryptAble {

    @Encrypt(EncryptType.SM4)
    private String phone;

    @Encrypt(EncryptType.SM3)
    private String password;
}
```

## Logical Delete Rules

当表结构中检测到存在 `is_delete` 字段时，优先按逻辑删除字段处理。

映射规则：

- 实体类中可以直接定义为 `boolean delete`
- 在字段上添加 `@TableLogic`
- 不需要在注解里手动填写逻辑删除值和未删除值，优先沿用全局配置
- 不要机械地保留 `isDelete` 或 `is_delete` 作为 Java 字段名，优先按现有工程风格映射为更自然的布尔语义字段

使用建议：

- 数据库字段是 `is_delete` 时，Java 字段优先使用 `delete`
- 若项目当前实体映射需要显式字段名，再结合现有 ORM 注解保持字段映射正确
- 不要在业务代码中手动维护删除标记值，优先交给逻辑删除机制处理

示例：

```java
@TableLogic
private boolean delete;
```

## I18n Message Rules

当前工程已集成 i18n。生成或修改返回信息时，优先复用并补充现有国际化资源文件，而不是把业务文案硬编码散落在代码里。

本文件是 i18n 的唯一权威来源：接口返回消息、业务异常消息、成功/失败提示的 i18n key 选择与合并规则都在这里定义，其他 reference 只引用本节，不再重复。

已知约定：

- `resources/i18n/messages.properties` 作为默认消息文件，默认中文
- `resources/i18n/messages_en_US.properties` 作为英文消息文件
- 如工程存在 `messages_zh_CN.properties`，优先保持与现有结构一致
- 先定位实际 `spring.messages.basename` 和资源所属模块，再决定补到哪个文件；不要在多模块工程里把资源写到错误模块

使用规则：

- 当返回信息需要国际化时，应在对应的 i18n 配置文件中补充消息 key
- 默认先补中文和英文两个版本，命名与现有文件保持一致
- 文案尽量通用，尤其是普通 CRUD 场景，优先使用通用消息而不是为每个模块单独造大量 key
- 无特殊业务语义时，不要定义过多国际化配置
- 若只是基础 CRUD 成功/失败提示，优先使用类似“新增成功”“更新成功”“删除成功”这类通用文案
- 只有在文档明确要求特殊业务提示时，才增加更细粒度的国际化消息
- 如果框架里已有预置 i18n 成功/失败消息，优先复用，不要重复新增同义 key
- 只有在用户明确要求“不返回 i18n”时，才不走国际化返回包装

### Key 合并原则

i18n key 的核心原则是：尽量把相同语义的文案合并成同一个 key，而不是为每个调用点单独造一个。key 的数量应保持精简，不宜过多。

- 新增提示前，先检索现有 i18n 资源文件，确认是否已有语义相同的 key：有则直接复用，没有再新增
- 语义相同的文案应共用一个 key，不要按模块、按接口拆分：例如“新增成功”统一走 `common.create.success`，不要给 `user.create.success`、`agent.create.success` 各造一个
- 只有当业务语义确实不同、文案需要差异化时，才拆分新 key：例如“新增成功”和“余额不足，请充值后再操作”是不同语义，应分别定义
- 检索时优先按中文语义匹配，而不是按 key 命名匹配：`common.create.success=新增成功` 和 `user.add.success=新增成功` 视为重复，应统一为前者
- 宁可一个 key 被多处复用，也不要为了“看起来专属”而扩散出一堆同义 key
- 如果一个新增提示和现有某 key 语义高度重合但文案略不同，优先对齐到现有 key 的文案，而不是新增

### 业务异常与 i18n

抛出 `BusinessException` 时传入的 i18n key 同样要遵守上面的规则。异常构造函数第一个字符串参数必须是 i18n key，而不是中文或英文文案；该 key 必须能在现有国际化资源文件中找到，否则应同步补 key，而不是把业务文案直接塞进异常构造函数。详见 `references/base-classes.md` 的 Exception Rules。

正确写法：

```java
throw new BusinessException("tenant.permission.denied");
```

错误写法（把文案当 i18n key）：

```java
throw new BusinessException("当前用户没有租户管理权限");
```

推荐示例：

- `common.create.success=新增成功`
- `common.update.success=更新成功`
- `common.delete.success=删除成功`

英文版本可对应：

- `common.create.success=Create success`
- `common.update.success=Update success`
- `common.delete.success=Delete success`
