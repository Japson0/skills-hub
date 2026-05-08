# dotnet-fastdev-backend

这个 skill 面向基于 Newland.Furion.SqlSugar.Template 的 .NET Web API 项目。

它会先读取开发文档和现有样例，再按既有工程模式生成：

- 开发方案
- 代码脚手架
- 实际后端实现

目前已经结合模板的典型结构做了定制，包括：

- Entity / Service / Controller / Input / DTO
- SqlSugar ORM Repository
- DBEntityBase 基类
- IDynamicApiController 动态控制器
- ITransient 依赖注入
- DataValidation 参数验证
- MD5Encryption 数据加密
- Oops.Bah() 业务异常
- AppUser 用户上下文
- JWT 认证集成

其中：

- `nupkg/Newland.Furion.SqlSugar.Template.1.0.0.nupkg`: 内置 .NET 项目模板包
- `references/project-init.md`: 新项目初始化规则
- `references/crud.md`: CRUD 和分页规则
- `references/base-classes.md`: 基类和基础设施
- `references/naming.md`: 命名规范
- `references/validation.md`: 参数验证规则

## 项目模板

Skill 内置 NuGet 模板包：`nupkg/Newland.Furion.SqlSugar.Template.1.0.0.nupkg`

基于源码模板：`/mnt/d/workstation/com.newland.edu/5_公共库/nle-dotnet-furion-sqlsugar`

### 安装模板

```bash
# 使用 skill 内置模板包安装（推荐）
dotnet new install ./nupkg/Newland.Furion.SqlSugar.Template.1.0.0.nupkg

# 或者从内部 NuGet 仓库下载安装
curl -o template.nupkg \
  http://192.168.133.170:5000/download/Newland.Furion.SqlSugar.Template/1.0.0
dotnet new install template.nupkg
```

### 创建新项目

```bash
dotnet new nl-furion-sqlsugar -n MyProjectName
```

## Files

- `SKILL.md`: skill 主定义
- `references/`: 按主题拆分的细则文件
- `evals/evals.json`: 测试 prompt 集合
- `nupkg/`: 内置 NuGet 模板包

## Next Steps

1. 把你自己的开发文档示例补进 `evals/evals.json`
2. 如果你有新规范，优先补到 `references/*.md`
3. 如果你希望这个 skill 更聚焦，比如"只生成 Entity"或"只处理分页查询"，可以继续收窄范围