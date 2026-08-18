# Base Classes

在 FastDev 风格工程里，先判断基础类已经覆盖了什么，再决定要不要补代码。

下面记录的 `BaseController4DTO`、`BaseService4DTO` 方法签名和 HTTP 动词是该工程的默认基线。不同工程的基础类版本可能存在差异，套用前先打开目标工程中基础类源码或相邻模块样例进行确认；存在差异时以目标工程实际实现为准，并向用户指出差异。

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

## 分页接口暴露规则

`BaseService4DTO` 提供了基础分页能力 `getPage(PageRequest)`，但 `BaseController4DTO` 默认不暴露分页接口。这是有意为之：并非所有 CRUD 模块都需要对外提供列表分页查询，避免无意义的接口暴露。

根据用户需求区分三种情况：

- 基础 CRUD（C/U/D + 单条 R）：不需要补任何分页代码
- 基础分页：用户明确要求“分页查询”但不涉及联表或复杂条件，直接在 Controller 补一个调用 `getPage()` 的接口即可，不需要自定义 Mapper 或 XML
- 自定义分页：用户明确要求联表、复杂条件或定制 SQL，才新增 Mapper 方法、XML SQL 和扩展 Service 方法

不要把基础分页误当成自定义分页去生成 Mapper 和 XML。

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

当任务涉及当前用户、角色、租户、组织、手机号验证、系统用户或登录态判断时，读取 `references/user-context.md`。该文件记录当前 `UserContext` 的完整 API、空值边界以及 `isLogin()` 的反直觉语义。

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

当前工程的业务异常统一使用 `com.nlecloud.spring.common.exception.BusinessException`，它继承 `net.github.fastdev.common.exception.CommonException`，并通过 `I18nUtils.getMessage(i18nKey, locale, args)` 解析异常消息，因此业务异常的内容必须以 i18n key 的形式提供，不允许把中文或英文业务文案直接作为异常内容传入。

### BusinessException 的参考定义

下面是 `BusinessException` 的参考结构，用来在使用时识别构造函数和 i18n 解析方式。注意：skill 不会自动创建该公共类，详见“复用规则”。

```java
package com.nlecloud.spring.common.exception;

import com.nlecloud.spring.common.i18n.I18nUtils;
import net.github.fastdev.common.exception.CommonError;
import net.github.fastdev.common.exception.CommonException;

import java.util.Locale;

public class BusinessException extends CommonException {

    public BusinessException(CommonError commonError) {
        this(commonError.getCode());
    }

    public BusinessException(Throwable throwable, CommonError commonError) {
        this(throwable, commonError.getCode());
    }

    public BusinessException(Throwable throwable, String code, CommonError commonError) {
        this(throwable, code, commonError.getCode(), null);
    }

    public BusinessException(String i18nKey, Object... args) {
        this(null, i18nKey, args);
    }

    public BusinessException(Throwable throwable, String i18nKey, Object... args) {
        this(throwable, null, i18nKey, null, args);
    }

    public BusinessException(Throwable throwable, String i18nKey, Locale locale, Object... args) {
        this(throwable, null, i18nKey, locale, args);
    }

    public BusinessException(Throwable throwable, String code, String i18nKey, Locale locale, Object... args) {
        super(throwable, code, I18nUtils.getMessage(i18nKey, locale, args));
    }
}
```

### 复用规则

- 业务异常统一使用目标工程中已有的 `com.nlecloud.spring.common.exception.BusinessException`
- 使用前先打开目标工程源码确认该类存在，并核对构造函数与参考定义是否一致
- 如果目标工程不存在该类，不要自动创建公共异常类，也不要下沉到业务模块造一个局部 `BusinessException`，先向用户说明情况并确认下一步
- 如果目标工程的 `BusinessException` 构造函数与参考定义不同，以目标工程实际签名为准

### 构造函数选用规则

- 已有 `CommonError` 可复用时，优先 `new BusinessException(CommonError.XXX)`，框架会用 `commonError.getCode()` 作为 i18n key
- 需要包装原异常并复用 `CommonError` 时，使用 `new BusinessException(throwable, CommonError.XXX)`
- 需要自定义国际化消息时，使用 `new BusinessException("i18n.key", args...)`，第一个参数必须是 i18n key
- 需要包装原异常并自定义国际化消息时，使用 `new BusinessException(throwable, "i18n.key", args...)`
- 需要指定 `Locale` 时，使用 `new BusinessException(throwable, "i18n.key", locale, args...)`
- 需要同时指定自定义 `code` 与 i18n key 时，使用 `new BusinessException(throwable, code, "i18n.key", locale, args...)`

### i18n key 作为异常内容

- 业务异常的内容必须通过 i18n key 提供，由 `I18nUtils.getMessage(i18nKey, locale, args)` 解析后作为异常 message
- 传入的第一个字符串参数一定是 i18n key（例如 `tenant.permission.denied`），而不是中文文案或英文文案
- 对应的 i18n key 必须能在工程现有的国际化资源文件中找到，否则应在生成代码时同步补 key，i18n key 的选择与合并规则统一见 `references/validation.md` 的 I18n Message Rules
- 如果已有 `CommonError`，其 `code` 会作为 i18n key，确保该 code 已在 i18n 资源中定义
- 不要为了“简单提示”就把异常文案硬编码进构造函数，例如 `new BusinessException("当前用户没有权限")` 是错误的写法

### 默认异常选择

- 默认优先抛出 `BusinessException`，因为它自带 i18n 能力
- 只有在用户明确要求“不需要 i18n”时，才直接使用 `CommonException`
- 不要默认为了省事直接抛裸 `RuntimeException` 或 `IllegalArgumentException`

### 自定义异常类规则

- 自定义异常类应继承 `CommonException`
- 自定义异常类只在存在明确复用价值或领域语义时再创建
- 如果只是单点业务异常，优先直接使用 `BusinessException` 或 `CommonException`
- 不要再创建一个和 `BusinessException` 语义重复的局部业务异常类
