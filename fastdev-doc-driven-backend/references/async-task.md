# 持久化异步任务

## 选型与源码核对

同时需要后台异步执行和任务状态持久化、重启恢复、失败重试等能力时，引用
`net.github.fast:spring-async-task-ctx`。复用 `TaskEngine` 和 Spring Bean `TaskHandler`，
不要另外创建线程池、`@Async` 方法加任务表来重写引擎。普通 CRUD 的数据持久化不属于这个触发条件；
仅需允许丢失的短时异步操作时，不强制引入本包。

先核对目标工程依赖版本及源码：`TaskEngine`、`TaskHandler`、`TaskContext`、`TaskResult`、
`TaskQuery`、`AsyncTaskProperties`、自动配置、实际 TaskStore 和建表脚本。
以下签名是默认基线，版本差异以实际实现为准。不要把本机源码路径写进业务工程。

Java 8/17 版本使用平台线程；JDK 25 版本可使用虚拟线程。根据目标工程 Java/Spring 版本选择对应发布版本，
不要因为接入任务能力擅自升级 JDK。不要生成不存在的 `@EnableAsyncTask`、`submit(Runnable)`、
`TaskEngine.get(taskId)`、取消/续租 API 或框架未提供的任务 Controller。

## 依赖与配置

父 POM 已管理版本时直接引用；否则使用目标工程确认的 FastDev 版本，不写死快照版本：

```xml
<dependency>
    <groupId>net.github.fast</groupId>
    <artifactId>spring-async-task-ctx</artifactId>
</dependency>
```

确认自动配置在当前 Boot 版本被加载，运行时有 Jackson `ObjectMapper`，并具备所选存储的依赖及连接配置。
部分发布版本的 Redis/JDBC 依赖是 provided，不能只看到传递依赖就假设运行时齐全。

任务明确要求数据库落库时选 JDBC：

```yaml
spring:
  application:
    name: report-service
fastdev:
  task:
    store: jdbc
    queue-name: report-service
    workers: 4
    pollers: 2
    poll-interval-millis: 3000
    lease-millis: 600000
    auto-create-table: false
    retry:
      max-retry: 3
      backoff-millis: 30000
```

- JDBC：确认 DataSource、Spring JDBC、驱动和实际数据库方言兼容。生产用迁移脚本创建
  `async_task_record` 及索引，DDL 以对应版本资源为准，不自行猜字段。开发环境才按需开启自动建表，
  并确认 JAR 中包含初始化器要求的脚本。不要因 JDBC 接口通用就宣称 SQL 支持所有数据库。
- Redis：将 `store` 设为 `redis`，确认 `StringRedisTemplate` 及连接配置。恢复保障取决于 Redis
  AOF/RDB、复制、故障切换、过期和淘汰策略；不能等同于严格不丢失。核对元数据 TTL 与任务生命周期。
- 命名空间使用稳定 `queue-name` 或 `spring.application.name`，不要依赖随机兜底，否则重启后可能无法消费旧任务。
  同服务集群共享命名空间和 Handler 路由；不同服务隔离。服务隔离不是租户鉴权。
- 核对是否已包含调度背压修复：修复后 `workers` 限制单实例在途任务数，`pollers` 控制独立拉取并发；
  Java 8/17 的 `workers` 也决定固定工作线程数。多实例并发会累加。旧版本可能尚未使用 `pollers`。
- 修复后的轮询每轮有界批量拉取；释放执行许可不会立即唤醒下一轮，不承诺实时启动。

## Handler 与提交示例

下面类是示例业务命名，实际使用时沿用工程包路径和业务编码约定。示例兼容 Java 8。

```java
import net.github.fastdev.asynctask.TaskContext;
import net.github.fastdev.asynctask.TaskHandler;
import net.github.fastdev.asynctask.TaskResult;
import org.springframework.stereotype.Component;

@Component
public class ReportTaskHandler implements TaskHandler {
    private final ReportService reportService;

    public ReportTaskHandler(ReportService reportService) {
        this.reportService = reportService;
    }

    @Override
    public String businessCode() {
        return "report.generate";
    }

    @Override
    public TaskResult handle(TaskContext context) throws Exception {
        String reportId = context.getString("reportId");
        String tenantId = context.getString("tenantId");
        if (reportId == null || tenantId == null) {
            throw new IllegalArgumentException("reportId/tenantId required");
        }
        // 示例业务方法：实现时替换成实际服务，并确保按租户隔离及业务幂等。
        reportService.generateIdempotently(tenantId, reportId);
        return TaskResult.success(reportId);
    }
}
```

提交侧注入 Spring 管理的 Handler，不使用 `new ReportTaskHandler(...)`、临时 lambda 或匿名对象。
编码保持稳定且唯一，删除或重命名业务编码前考虑历史待执行任务的兼容性。

```java
import net.github.fastdev.asynctask.TaskEngine;
import org.springframework.stereotype.Service;
import java.util.HashMap;
import java.util.Map;

@Service
public class ReportTaskService {
    private final TaskEngine taskEngine;
    private final ReportTaskHandler handler;

    public ReportTaskService(TaskEngine taskEngine, ReportTaskHandler handler) {
        this.taskEngine = taskEngine;
        this.handler = handler;
    }

    // tenantId 必须由鉴权后的上下文确定，不直接信任外部请求中的租户标识。
    public String submit(String tenantId, String reportId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("tenantId", tenantId);
        payload.put("reportId", reportId);
        return taskEngine.submit(handler, tenantId + ":" + reportId, payload);
    }
}
```

payload 使用可 JSON 序列化的对象结构，优先存业务 ID 和必要快照。Handler 收到的是反序列化后的 Map，
不要强转回原 DTO；按真实字段类型使用 `getString`、`getLong`、`getInteger` 或显式映射。
不要保存 request、流、连接、Spring Bean、访问令牌及不必要的敏感信息。

## 查询、等待与返回语义

```java
import net.github.fastdev.asynctask.TaskQuery;
import net.github.fastdev.asynctask.TaskRecord;
import net.github.fastdev.asynctask.TaskResult;
import java.time.Duration;
import java.util.List;

// 以下片段在已注入 taskEngine 的业务方法内使用：
List<TaskRecord> records = taskEngine.query(
        TaskQuery.of("report.generate", tenantId + ":" + reportId));
TaskResult result = taskEngine.await(taskId, Duration.ofSeconds(2));
```

- 提交成功只表示保存并接受任务，向调用方返回任务 ID，不当作业务已完成。
- 默认 `TaskEngine` 只有 `submit`、`await`、`query`，不提供直接按 ID 查详情的方法。
  默认查询是列表，不冒充项目分页结果；需要按 ID 安全查询或分页时，先核对版本，再明确扩展边界。
- 暴露状态/结果接口前校验用户、租户和任务归属。tag 只是过滤标签，不能当授权机制；
  不把未授权的 TaskRecord、payload、异常信息原样暴露给前端。
- `await` 是有界阻塞等待，不是取消。当前本地 latch 无法被其他实例直接通知，并存在注册竞争，
  可能等到超时兜底查询才看到结果；不要承诺集群即时唤醒。null 不能单独作为 FAILED 的判断依据。
- 当前引擎 Handler 正常返回（包括 null）即更新 SUCCESS。`TaskResult.failure()` 仅设置结果布尔值，
  不会触发状态 FAILED 或重试。需要走现有重试流程时抛异常；不要吞异常后返回 success。
  不可重试失败的区分需要核对或扩展引擎，不能假装现有接口已经支持。

## 事务、上下文及可靠性

- 先明确业务数据与任务保存的原子性要求。JDBC 同数据源、同事务管理器参与同一事务时，
  核对业务写入和任务落库能否一同提交/回滚。Redis 不会自动加入数据库事务。
- 提交后投递可避免执行器读到未提交数据，但“业务提交后、任务保存前”崩溃仍可能漏投，
  投递失败也不能回滚已提交业务。要求严格不漏投时，确认同事务任务落库或另行设计事务 outbox/补偿，
  不将普通 afterCommit 回调描述成可靠投递保证。不要在同一未提交事务内提交后立即 await。
- 请求 ThreadLocal 不会自然跨异步、持久化和重启传播。显式保存必要 userId/tenantId/orgId；
  优先将租户传给业务服务。必须恢复 `UserContext` 时，读取 `user-context.md`，使用目标工程真实 API，
  在 finally 清理/恢复原上下文。不持久化整份登录态，不伪造系统管理员身份。
- 按至少一次/可能重复的语义实现业务幂等，优先使用稳定业务键配合数据库约束或原子状态流转；
  每次提交都会创建新任务，taskId 不等于跨重复提交的业务幂等键。
- 租约回收不终止旧执行。当前没有自动续租和执行批次校验保证，超过 `lease-millis` 可能重复执行，
  旧执行也可能覆盖后续结果。设置下游超时，并按任务耗时规划租约；长任务续租需单独实现。
- 重试配置不等于完整可靠性承诺。核对实际 store：已知基线 Redis 的 poll 未按 nextRunTime 延迟消费，
  出队与状态抢占非整体原子，不能宣称严格退避/绝不丢任务；严格要求需先修复并验证。
- 不在业务接入代码里重写调度、回收、重试线程池。框架能力不满足可靠性要求时指出缺口并提出专项修复。

## 验收清单

- 正确引用模块版本，所选存储自动装配生效，生产 DDL/命名空间稳定。
- Handler 是 Spring Bean，业务编码唯一，payload 重启后可反序列化和执行。
- 提交返回任务 ID，按真实 API 查询；结果接口检查归属，敏感字段不外泄。
- 正常执行写入 SUCCESS；异常按实际重试策略处理；不通过 `TaskResult.failure()` 假装触发重试。
- 用集成测试验证事务提交/回滚、存储故障、进程重启和多实例抢占；单元 mock 不替代恢复验证。
- 验证重复投递幂等、用户上下文清理、租约边界，且不承诺恰好一次、严格不丢失或已有自动续租。
