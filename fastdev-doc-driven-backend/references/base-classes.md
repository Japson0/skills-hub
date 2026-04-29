# Base Classes

在 FastDev 风格工程里，先判断基础类已经覆盖了什么，再决定要不要补代码。

## BaseController4DTO

已知 `BaseController4DTO<ID, T, DTO>` 内置以下接口：

- `@PostMapping`：更新
- `@PutMapping`：新增
- `@DeleteMapping("/{id}")`：删除
- `@GetMapping("{id}")`：详情

使用规则：

- 如果模块继承 `BaseController4DTO`，不要重复声明新增、更新、删除、详情接口
- 如果用户只说“生成单表 CRUD”，先默认复用这 4 个基础接口
- 只有用户明确要求扩展接口时，才新增 Controller 方法
- 分页接口不默认创建，只有用户明确要求自定义分页时才补充

## RESTful Conflict

`BaseController4DTO` 的新增/更新 HTTP 动词与常见 RESTful 习惯相反：

- 新增使用 `PUT`
- 更新使用 `POST`

如果用户同时要求：

- 继承 `BaseController4DTO`
- 严格 RESTful，新增用 `POST`、更新用 `PUT`

先指出冲突，并让用户选择：

- 继续复用基础类，接受现有接口约定
- 放弃继承基础类，手写严格 RESTful 接口

## BaseService4DTO

已知 `BaseService4DTO<ID, R, DTO>` 内置以下能力：

- `<Q> PageResponse<DTO> getPage(PageRequest<Q> pageConditionDTO)`
- `int addOrUpdate(DTO entity)`
- `int addOrUpdate(DTO entity, boolean allColumns)`
- `R getById(ID id)`
- `int updateById(DTO entity, boolean allColumns)`
- `int deleteById(ID id)`
- `int deleteById(List<ID> ids)`
- `int addById(DTO entity)`

使用规则：

- 不要在 Service 接口中重复声明这些基础方法
- 不要在 ServiceImpl 中重复实现这些基础方法
- 如果只是单表基础 CRUD 或基础分页，优先复用 `BaseService4DTO`
- 只有在用户要求自定义分页、自定义查询、联表查询或附加业务逻辑时，才新增 Service 方法

## Combined Strategy

如果模块同时使用 `BaseController4DTO` 和 `BaseService4DTO`：

- `Entity`、`DTO`、`Query`、必要的 `Req`、枚举类仍然要生成
- 优先复用基础 Controller 和基础 Service 的现成能力
- 不重复声明基础 CRUD Service 方法
- 不重复实现基础 CRUD Controller 方法
- 不重复为基础分页额外造一套 Service 方法
- 只有在文档明确要求自定义分页、自定义查询或附加业务逻辑时，才新增扩展方法

## User Context

当用户需要获取当前访问系统的用户信息时，优先使用 `com.nlecloud.spring.scaffold.common.UserContext`。

已知可直接使用的方法包括：

- `UserContext.getUserId()`
- `UserContext.getUserName()`
- `UserContext.getTenantId()`
- `UserContext.getRoles()`
- `UserContext.getUserInfo()`
- `UserContext.isAdmin()`
- `UserContext.hasUser()`
- `UserContext.isRobot()`

使用规则：

- 需要当前登录用户 id 时，优先使用 `UserContext.getUserId()`
- 需要当前用户名时，优先使用 `UserContext.getUserName()`
- 需要当前租户时，优先使用 `UserContext.getTenantId()`
- 需要完整用户信息对象时，优先使用 `UserContext.getUserInfo()`
- 需要判断管理员身份时，优先使用 `UserContext.isAdmin()`
- 不要自行从 request、session、header 里重复解析用户信息，除非文档明确要求绕过现有上下文机制
- 如果只是接口里读取当前用户，优先沿用现有 `UserContext` 访问方式，保持与样例代码一致

注意：

- `getSchoolId()` 已标记为 `@Deprecated`，没有明确要求时不要优先使用
- 如果代码运行在机器人或系统上下文场景，可留意 `getRobotUser()` 与 `isRobot()`

## Result Wrapper Rules

当前工程优先使用 `com.nlecloud.spring.common.RestResult` 返回接口结果。

已知规则：

- `RestResult.renderSuccess()` 走预置的 i18n 成功消息
- `RestResult.renderSuccess(data)` 走预置的 i18n 成功消息并返回数据
- `RestResult.renderSuccess2Msg(i18nKey)` 用指定 i18n key 返回成功消息
- `RestResult.renderError(IErrorCode errorCode)` 走预置的 i18n 错误消息
- `RestResult.renderError(String i18nKey)` 用指定 i18n key 返回错误消息

使用规则：

- 默认优先使用 `RestResult`
- 如果成功或失败信息已经有预置的 i18n 配置，优先使用 `renderSuccess` 或 `renderError(IErrorCode errorCode)`
- 如果需要返回自定义国际化消息，可使用 `renderSuccess2Msg(i18nKey)` 或 `renderError(String i18nKey)`
- 只有当用户明确指定“不需要返回 i18n”时，才改用 `RestResponse`
- 不要在默认情况下为了简单提示改回 `RestResponse`

## Exception Rules

当前工程默认优先使用带 i18n 能力的 `com.nlecloud.spring.common.exception.BusinessException` 抛业务异常。

已知规则：

- `BusinessException(CommonError commonError)` 使用预置错误码与 i18n 消息
- `BusinessException(String i18nKey, Object... args)` 使用指定 i18n key
- `BusinessException(Throwable throwable, String i18nKey, Object... args)` 支持包装原异常并返回 i18n 消息
- `BusinessException` 底层继承 `CommonException`

使用规则：

- 默认优先抛出 `BusinessException`
- 如果异常信息需要国际化，优先使用 `BusinessException`
- 如果已有 `CommonError` 可复用，优先使用 `new BusinessException(CommonError.XXX)`
- 如果需要自定义国际化消息，优先使用 `new BusinessException("i18n.key", args...)`
- 只有在用户明确要求“不需要 i18n”时，才直接使用 `CommonException`
- 如果用户需要新增自定义异常类，优先继承 `net.github.fastdev.common.exception.CommonException`
- 不要默认为了省事直接抛裸 `RuntimeException`

自定义异常类规则：

- 自定义异常类应继承 `CommonException`
- 自定义异常类只在存在明确复用价值或领域语义时再创建
- 如果只是单点业务异常，优先直接使用 `BusinessException` 或 `CommonException`
