---
name: git-commit
description: '执行 git commit，包含 Conventional Commits 规范的提交信息分析、智能暂存和消息生成。在用户要求提交更改、创建 git commit 或提到 "/commit" 时使用。'
license: MIT
allowed-tools: Bash
---

# Git Commit 提交规范

## 概述

使用 Conventional Commits 规范创建标准化的语义化提交。分析实际 diff 来确定适当的类型、范围和消息。

## 提交格式

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## 提交类型

| Type       | 用途                      |
| ---------- | ------------------------ |
| `feat`     | 新功能                    |
| `fix`      | Bug 修复                  |
| `docs`     | 仅文档变更                |
| `style`    | 格式/样式调整（无逻辑变更）|
| `refactor` | 重构（无功能/修复变更）    |
| `perf`     | 性能优化                  |
| `test`     | 添加/更新测试             |
| `build`    | 构建系统/依赖             |
| `ci`       | CI/配置变更               |
| `chore`    | 维护/杂项                 |
| `revert`   | 回退提交                  |

## Breaking Changes

```
# 类型/范围后的感叹号
feat!: 移除已废弃的接口

# BREAKING CHANGE footer
feat: 支持配置继承其他配置

BREAKING CHANGE: `extends` 键的行为已变更
```

## 工作流程

### 1. 分析 Diff

```bash
# 如果有暂存的文件，使用 staged diff
git diff --staged

# 如果没有暂存，使用工作区 diff
git diff

# 同时检查状态
git status --porcelain
```

### 2. 暂存文件（如需要）

如果没有暂存文件或需要重新分组：

```bash
# 暂存指定文件
git add path/to/file1 path/to/file2

# 按模式暂存
git add *.test.*
git add src/components/*

# 交互式暂存
git add -p
```

**禁止提交敏感信息**（.env、credentials.json、私钥等）。

### 3. 生成提交信息

分析 diff 确定：

- **Type**: 这次变更是什么类型？
- **Scope**: 影响哪个模块/区域？
- **Description**: 一句话总结变更内容（现在时、祈使语气、<72 字符）
- **Body** (可选): 详细说明*为什么*要做这个变更，*做了什么*，与之前的*区别*。多个要点可用列表。
- **Footer** (可选): Issue 引用（`Closes #123`）、Breaking Change 说明（`BREAKING CHANGE:`）或其他元数据。

####何时包含 Body/Footer

| 场景          | 应包含 Body                    | 应包含 Footer |
| ------------ | ---------------------------- | ------------ |
| Bug 修复      | 修复了什么症状，根因是什么      | `Fixes #xxx` |
| 新功能        | 如何使用，能实现什么            | `Closes #xxx` |
| 重构          | 为什么要重构                   | — |
| Breaking 变更 | 迁移步骤，行为差异              | `BREAKING CHANGE:` |
| 复杂变更      | 逐步拆解说明                    | 相关 issues  |

### 4. 执行提交

```bash
# 单行（仅用于简单变更）
git commit -m "<type>[scope]: <description>"

# 多行包含 body（推荐用于大多数提交）
git commit -m "$(cat <<'EOF'
<type>[scope]: <description>

<详细说明为什么和做了什么>

<可选 footer: Closes #xxx, BREAKING CHANGE 等>
EOF
)"
```

## 最佳实践

- 每个提交只做一个逻辑变更
- 现在时："add" 而非 "added"
- 祈使语气："fix bug" 而非 "fixes bug"
- **非简单变更必须包含 body** — 解释为什么做这个变更
- 引用 issue：`Closes #123`、`Refs #456`
- 描述保持在 72 字符以内
- Breaking 变更必须包含 `BREAKING CHANGE:` footer

## Git 安全协议

- 禁止修改 git 配置
- 禁止执行破坏性命令（--force、hard reset），除非用户明确要求
- 禁止跳过 hooks（--no-verify），除非用户要求
- 禁止强制推送到 main/master
- 如果提交因 hooks 失败，修复后创建新提交（不要 amend）
