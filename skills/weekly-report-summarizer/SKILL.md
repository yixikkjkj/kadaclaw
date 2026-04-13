---
name: weekly-report-summarizer
description: Use this skill when the user wants to turn Chinese daily reports, development logs, task bullets, or a rough weekly task list into a polished weekly report with clear completed work, highlights, risks, and next-step planning.
---

# Weekly Report Summarizer

Use this skill to convert scattered daily reports or weekly task bullets into a clean Chinese weekly report.

## Goal

- Read the user's daily reports, task fragments, or completed work bullets.
- Merge duplicated items and keep the real project names, feature names, and technical nouns.
- Reorganize the content into a readable weekly report instead of copying the raw list.
- Emphasize delivered outcomes, not just action verbs.
- Keep the wording factual and concise.

## When To Use

- The user says `帮我整理成周报`、`汇总这周日报`、`输出本周工作总结`、`写一版周报`.
- The input is a loose list of completed tasks and the user wants a management-facing summary.
- The user needs a structured report for IM, email, or internal docs.

## Workflow

1. Read all raw daily report items first.
2. Normalize wording:
   - merge duplicated actions
   - combine obviously related items into one theme
   - preserve product names such as `OpenClaw`, `Kadaclaw`, `1688`, `Control UI`
3. Infer the main workstreams. Common groupings:
   - runtime / infrastructure
   - chat workspace / UI
   - skill design / installation / recognition
   - specific business or automation skills
4. Rewrite each workstream from “做了什么” to “完成了什么结果”.
5. Do not fabricate numbers, timelines, risks, or impact that the user did not provide.
6. If the user did not provide blockers or plans:
   - omit those sections, or
   - state them conservatively as `本周未新增明显阻塞项` / `下周将继续围绕当前改造收尾与验证`
7. Default to Chinese output unless the user requests another language.

## Default Output Structure

Prefer this structure:

```markdown
本周工作总结

1. 重点进展
- ...
- ...

2. 关键成果
- ...
- ...

3. 问题与风险
- ...

4. 下周计划
- ...
```

If the input is short, you may compress it into:

```markdown
本周主要完成以下工作：
1. ...
2. ...
3. ...
```

## Writing Rules

- Prefer grouped summaries over one-to-one copying of the raw bullets.
- Each bullet should describe a completed outcome, not a vague process.
- Keep tense consistent and concise.
- Preserve technical specificity:
  - `OpenClaw 自定义中转站接入`
  - `bundled runtime 与外部 OpenClaw 端口冲突修复`
  - `1688 商品采集 skill 调试与重构`
- When several items point to the same theme, merge them into one stronger bullet.
- Avoid empty phrases such as `持续推进`、`相关优化` unless paired with a concrete result.

## Quality Bar

- The final weekly report should be shorter and cleaner than the raw daily logs.
- A reader who did not follow the project day by day should still understand:
  - what changed
  - what was delivered
  - what was fixed
  - what remains next
