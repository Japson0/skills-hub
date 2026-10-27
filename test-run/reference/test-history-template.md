# Test History 报告模板



## testHistory/LATEST.md（每次覆盖）



```markdown

# 测试报告 · {runAtLocal}



**结果**: {statusEmoji} {failed} failed · {passed} passed · {skipped} skipped

**触发**: {trigger}

**Commit**: {gitSha} · 分支 {gitBranch}



## 需要关注



| 模块 | 失败 | 说明 |

|------|------|------|

| {module} | {count} | {oneLineSummary} |



→ 详细报告: [{timestamp}/summary.md](./{timestamp}/summary.md)



## 建议下一步



- {N} 项失败 → **Agent 须读源码完成静态分析，并写入 summary 的「代码分析」**

- （enrich 后）报告已含代码分析 → 可直接按 summary 修复，或 **/test-run-fix**



---

*完整历史见 testHistory/ 下各时间戳目录*

```



## testHistory/<timestamp>/summary.md



```markdown

# Test Run {runAtLocal}



## 概览



- Vitest: {passed} passed, {failed} failed, {skipped} skipped

- 触发: {trigger}

- Git: {gitSha} ({gitBranch})



## {moduleName}



### ❌ 未通过 ({failCount})



<!-- failure:{fingerprint} -->

#### {testName}



- **文件**: `{filePath}`

- **Catalog**: {catalogId} @confirmed

- **被测源文件**: `{sourcePath}`

- **预期 vs 实际**: {expectedVsActual}

- **Vitest 报错**: {errorFirstLines}

- **判断**: {triageCategory} · {catalogId}

- **初步线索**: {baselineHint}



##### 代码分析



- **可能原因**:

  - {cause1}

  - {cause2}

- **根因**: {rootCause}

- **相关代码**: `{file}:{lineRange}`

- **建议修复方向**: {fixDirection}

- **修复建议**: {fixSuggestion}

- **风险**: {risk}

- **下一步**: {nextStep}

<!-- /failure:{fingerprint} -->



---



## 归档



- [vitest-output.json](./vitest-output.json)

- [report.json](./report.json)

```



## .cursor/test-last-run.json



```json

{

  "runAt": "2026-06-30T07:15:00+08:00",

  "status": "fail",

  "analysisEnriched": true,

  "failures": [

    {

      "module": "pagination",

      "test": "Pagination 分页组件 ...",

      "file": "tests/unit/pagination.test.ts",

      "catalogId": "PG-05",

      "sourcePath": "src/components/Pagination/index.vue",

      "fingerprint": "f923581c5c23",

      "triage": "Logic-Bug",

      "enriched": true,

      "analysis": {

        "rootCause": "...",

        "fixSuggestion": "...",

        "risk": "低"

      }

    }

  ]

}

```



## enrich 输入（不落盘）

Agent 分析完成后，将 `{ "analyses": [...] }` **pipe 到 stdin** 执行 `enrich-test-report.mjs`。
分析结果写入 `summary.md` 与 `report.json`。**不要**创建 `test-run-analysis.json`。

## fingerprint



`testFile + testName + firstLineOfError` 的短 hash，跨 run 识别同一失败。

