# 时间获取与计量规范

## 何时读取

生成或修改的业务代码涉及获取系统当前时间、基于当前时间构造日期对象、测量耗时或本进程超时判断时，读取本文件。
只解析历史日期、格式化已有时间或处理外部传入时间时，不需要额外获取当前时间。

## 当前时间的统一入口

获取当前毫秒时间戳，统一使用 `cn.hutool.core.date.SystemClock.now()`，不要使用 `System.currentTimeMillis()`。
需要多个字段表达同一业务时刻时，读取一次并复用，避免时间不一致。

```java
import cn.hutool.core.date.SystemClock;

long nowMillis = SystemClock.now();
```

沿用目标工程统一管理的 Hutool 依赖；缺少依赖时按现有依赖管理补齐，不写死或擅自升级版本，
也不为一个时钟调用新建工具类、定时缓存或线程池。

## 日期时间对象与时区

需要当前日期时间对象时，基于统一入口的时间戳转换，不使用无参 `new Date()`、
`Instant.now()`、`LocalDateTime.now()` 等另取当前时间。

```java
import cn.hutool.core.date.SystemClock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;

long nowMillis = SystemClock.now();
Date nowDate = new Date(nowMillis);
Instant nowInstant = Instant.ofEpochMilli(nowMillis);
// businessZone 来自项目实际配置或已有时区约定，不硬编码新的时区。
ZoneId zone = businessZone;
LocalDateTime nowLocal = LocalDateTime.ofInstant(nowInstant, zone);
```

时区转换使用项目已明确的业务时区；没有约定且会影响接口或落库含义时先确认。
不要把不带时区的 LocalDateTime 当成可跨时区比较的绝对时间。
历史时间、上游事件时间、数据库生成时间等已有时间来源保持原语义，不机械改成“当前时间”。

## 耗时及本进程超时

`System.nanoTime()` 用于单调耗时计量，不是获取业务当前时间，不能用 SystemClock 替代。

```java
import java.util.concurrent.TimeUnit;

long started = System.nanoTime();
executeBusiness(); // 替换为实际业务调用
long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
```

超时判断同样使用差值，例如 `System.nanoTime() - started >= timeoutNanos`，超时长度应为有效的非负值。
不要将 nanoTime 作为创建时间落库、转换日期、跨 JVM 比较或用于重启后恢复的截止时间。
数据库中的租约时间、可跨进程共享的到期时间使用当前时间戳；跨实例还需考虑时钟同步和偏差。

## 使用边界与检查

- SystemClock 通常读取后台周期更新的缓存时间，存在更新延迟，不承诺调用当下精确到毫秒。
- 当前时间戳是墙上时钟，受系统校时影响，可能回拨；不能用前后时间戳相减代替严格耗时计量。
- nanoTime 的单位是纳秒，不代表分辨率一定达到纳秒，也不代表 native 调用必然发生系统调用或线程切换。
- 验证时间戳单位、项目时区和同一业务时刻的复用；不要把秒、毫秒和纳秒混用。
- 只修改本次需求涉及的时间代码，不顺手全工程替换已有时间调用。
