# User Context

当前工程通过 `com.nlecloud.spring.scaffold.common.UserContext` 保存和读取当前线程的用户信息。业务代码应复用该上下文，不要自行从 request、session 或 header 重复解析用户身份。

下面记录的 API、空值边界和 `isLogin()` 语义是该工程的默认基线。不同工程的 `UserContext` 实现版本可能存在差异，套用前先打开目标工程中 `UserContext` 源码或相邻模块样例进行确认；存在差异时以目标工程实际实现为准，并向用户指出差异。

## 可用能力

用户基本信息：

- `UserContext.getUserId()`：当前用户 id
- `UserContext.getUserName()`：当前用户名
- `UserContext.getUserInfo()`：完整 `UserInfo`
- `UserContext.getRoles()`：当前用户角色集合
- `UserContext.isAdmin()`：角色集合是否包含 `admin`
- `UserContext.isPhoneVerify()`：当前用户是否已完成手机号验证

租户与组织信息：

- `UserContext.getTenantId()`：当前租户 id
- `UserContext.getOrgId()`：当前组织 id；用户已存在但没有组织信息时返回 `null`
- `UserContext.isTenantAdmin()`：当前租户信息存在且用户为租户管理员
- `UserContext.isPersonTenant()`：当前租户类型是否为 `TenantType.PERSON`
- `UserContext.isOrgAdmin()`：当前组织信息存在且用户为组织管理员

上下文状态与系统用户：

- `UserContext.hasUser()`：当前线程是否存在用户信息
- `UserContext.getRobotUser()`：获取固定的系统用户
- `UserContext.isRobot()`：当前用户是否为该系统用户实例
- `UserContext.setUserInfo(UserInfo)`：设置当前线程用户信息
- `UserContext.clean()`：清理当前线程用户信息

## 使用规则

- Controller 或 Service 只读取当前用户时，直接调用对应的 `UserContext` getter。
- 匿名访问、异步任务或其他可能没有用户上下文的入口，先调用 `UserContext.hasUser()`；`getUserId()`、`getUserName()`、`getTenantId()`、`getRoles()`、`getOrgId()`、`isPhoneVerify()` 和各类身份判断大多会先访问 `getUserInfo()`，没有用户时可能抛出 `NullPointerException`。
- `isTenantAdmin()`、`isPersonTenant()` 和 `isOrgAdmin()` 只对缺失的租户或组织信息做了空值保护，并没有对缺失的 `UserInfo` 做保护。
- `isAdmin()` 直接调用 `getRoles().contains("admin")`。如果项目不能保证角色集合非空，应先检查完整用户信息中的角色集合，不要假设该方法本身是空值安全的。
- 租户管理员、组织管理员和平台 `admin` 是三个不同维度，不要相互替代。根据业务文档选择 `isTenantAdmin()`、`isOrgAdmin()` 或 `isAdmin()`。
- 判断个人租户时使用 `isPersonTenant()`，不要在业务代码中重复读取 `TenantInfo` 并比较 `TenantType.PERSON`。
- `setUserInfo()` 和 `clean()` 属于上下文生命周期操作，通常应由过滤器、拦截器或任务边界负责。普通业务方法不要为了方便覆盖或清理当前用户。
- 使用线程池或异步任务时，只有在项目已有上下文传递机制时才依赖 `UserContext`；任务结束必须由上下文管理边界清理 ThreadLocal，避免线程复用导致身份泄漏。

## 登录态陷阱

当前实现中的 `isLogin()` 为：

```java
public static boolean isLogin() {
    return USER_INFO_LOCAL.get() == null;
}
```

它在用户信息不存在时返回 `true`，与方法名通常表达的语义相反。生成新代码时不要使用 `isLogin()` 判断登录态，统一使用：

```java
if (UserContext.hasUser()) {
    Long userId = UserContext.getUserId();
}
```

如果现有业务代码已经使用 `isLogin()`，先指出当前实现语义，再结合调用方确认是历史约定还是实现错误，不要静默反转业务条件。

## 废弃能力

`UserContext.getSchoolId()` 已标记为 `@Deprecated`。新代码统一使用 `getTenantId()`；只有维护明确依赖旧 school 语义的兼容代码时才保留 `getSchoolId()`。

## 示例

需要按租户或组织权限执行操作时，可按业务要求组合判断：

```java
if (!UserContext.hasUser()) {
    throw new BusinessException(CommonError.UNAUTHORIZED);
}

if (!UserContext.isTenantAdmin()) {
    throw new BusinessException("tenant.permission.denied");
}

Long tenantId = UserContext.getTenantId();
Long operatorId = UserContext.getUserId();
```

异常类型和错误码必须优先复用当前项目已有定义；上例中的错误项仅表示调用形式，不应在缺少项目依据时直接生成。
