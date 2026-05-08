# Project Initialization

当用户要求从零创建一个符合 Newland.Furion.SqlSugar.Template 风格的 .NET 项目时，优先使用模板命令初始化，而不是手工创建基础工程。

## 安装模板

Skill 内置 NuGet 模板包：`nupkg/Newland.Furion.SqlSugar.Template.1.0.0.nupkg`

### 方法1：使用 Skill 内置模板包安装（推荐）

```bash
# 使用 skill 内置模板包安装
dotnet new install ./nupkg/Newland.Furion.SqlSugar.Template.1.0.0.nupkg
```

### 方法2：从内部 NuGet 仓库下载安装

```bash
# 下载模板包（需要网络环境允许）
curl -o template.nupkg \
  http://192.168.133.170:5000/download/Newland.Furion.SqlSugar.Template/1.0.0

# 安装模板
dotnet new install template.nupkg
```

### 方法3：从本地项目打包安装

```bash
# 打包模板（如果有源码）
./pack.sh 1.0.0

# 安装本地包
dotnet new install ./nupkg/Newland.Furion.SqlSugar.Template.1.0.0.nupkg
```

## 创建新项目

### 基本用法

```bash
# 基本创建（默认 MySql，.NET 8.0）
dotnet new nl-furion-sqlsugar -n MyProjectName

# 创建并指定输出目录
dotnet new nl-furion-sqlsugar -n MyProject -o ./MyProject
```

### 自定义参数

```bash
# 使用 SQL Server 数据库
dotnet new nl-furion-sqlsugar -n MyProject --db-type SqlServer

# 使用 PostgreSQL 数据库
dotnet new nl-furion-sqlsugar -n MyProject --db-type PostgreSQL

# 使用 .NET 9.0 框架
dotnet new nl-furion-sqlsugar -n MyProject --framework net9.0

# 禁用 Swagger
dotnet new nl-furion-sqlsugar -n MyProject --enable-swagger false

# 跳过 NuGet 还原
dotnet new nl-furion-sqlsugar -n MyProject --no-restore
```

## 可用参数

| 参数 | 短名 | 默认值 | 可选值 | 说明 |
|------|------|--------|--------|------|
| `--db-type` | `--db` | MySql | MySql, SqlServer, PostgreSQL, Oracle, Sqlite | 数据库类型 |
| `--framework` | `--fw` | net8.0 | net8.0, net9.0 | 目标框架 |
| `--enable-swagger` | `--sw` | true | true, false | 启用 Swagger UI |
| `--no-restore` | - | false | true, false | 跳过自动还原 |

## 项目结构

创建完成后，项目将包含以下结构：

```
MyProject/
├── MyProject.sln                 # 解决方案文件
├── MyProject.Core/               # 基础设施层
│   ├── SqlSugar/                 # ORM 配置和扩展
│   ├── Const/                    # 常量
│   ├── Enum/                     # 枚举
│   └── AppUser.cs                # 用户上下文
├── MyProject.Application/        # 业务逻辑层
│   ├── Entity/                   # 实体类
│   └── Services/                 # 业务服务
│       ├── Auth/                 # 认证服务
│       ├── User/                 # 用户服务
│       └ SysConfig/              # 系统配置
│       └ SysOperate/             # 系统操作
├── MyProject.Web.Core/           # 控制器层
│   ├── Controllers/              # API 控制器
│   ├── Handlers/                 # JWT 处理器
│   └── Startup.cs                # 启动配置
├── MyProject.Web.Entry/          # 入口层
│   ├── Program.cs                # 应用入口
│   └── appsettings.json          # 配置文件
└ NuGet.config                    # NuGet 配置
├── .editorconfig                 # 编辑器配置
└── .gitignore                    # Git 忽略规则
```

## 初始化后配置

### 数据库连接

编辑 `MyProject.Web.Entry/appsettings.json`：

```json
{
  "ConnectionStrings": {
    "DefaultDbType": "MySql",
    "DefaultDbString": "Data Source=localhost;Database=mydb;User ID=root;Password=password;"
  }
}
```

### JWT 配置

JWT 配置在 `Startup.cs` 中已预置，默认启用全局授权。

### Swagger 配置

编辑 `appsettings.json` 自定义 Swagger：

```json
{
  "SpecificationDocumentSettings": {
    "DocumentTitle": "MyProject API",
    "GroupOpenApiInfos": [
      {
        "Group": "Default",
        "Title": "API Documentation",
        "Version": "1.0.0"
      }
    ]
  }
}
```

## 规则

- 如果用户明确要"从零创建项目"或"初始化新工程"，优先建议或执行模板命令
- 只有在用户明确要求不用模板或模板不适用时，才考虑手工初始化
- 初始化完成后，再按开发文档继续补模块、接口、实体等业务代码
- 如果用户只想新增模块或新增业务代码，不要误用项目初始化命令

## 运行项目

```bash
cd MyProject
dotnet restore
dotnet build
dotnet run --project MyProject.Web.Entry
```

## When To Read This File

- 用户提到"创建项目"
- 用户提到"初始化工程"
- 用户提到"从零搭一个 .NET 项目"
- 用户提到"使用模板创建项目"