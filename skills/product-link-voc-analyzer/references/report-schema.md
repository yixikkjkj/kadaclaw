# Report Schema

This skill produces two levels of output.

## Single Product Report

- 商品概览
- 风险等级
- 正向卖点
- 高频问题
- 问答关键信息
- 代表性消费者原声
- 优先优化建议

## Cross-Product Summary

- 样本总览
- 风险等级排行
- 共同问题词
- 共同正向卖点
- 优先优化商品
- 建议下一步验证动作

## Evidence Rules

- Reviews and Q&A are weighted separately.
- Repeated issues matter more than isolated mentions.
- Severe issues such as `异味`, `漏水`, `开胶`, `开裂`, `质量差`, `掉色` should increase product risk more strongly.
- If multiple products share the same issue, it should be highlighted in the summary report.
