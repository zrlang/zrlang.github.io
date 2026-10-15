---
title: 路线图
description: zr 从 v0.5.0 到 v1.0.0 的开发计划：已完成、进行中与计划中的工作。
sidebar: community_sidebar
prev:
  title: 社区
  url: /community/
next:
  title: 贡献指南
  url: /community/contributing/
---

zr 目前处于 **0.x** 阶段：语言仍在演进，API 尚未冻结。

## v0.5.0（当前） ✅

完整的编译流水线与广覆盖的目标平台。

- [x] 词法分析器（生成器驱动的有限状态机）
- [x] 递归下降 + Pratt 解析器
- [x] HIR + Hindley-Milner 类型推导
- [x] trait 系统 + 约束求解
- [x] 借用检查器框架（NLL）
- [x] 模式穷尽性检查
- [x] MIR / SSA 降级（支配树、φ 插入、寄存器重命名）
- [x] 优化 pass 框架
- [x] 代码生成：x86-64、AArch64、ARM32、RISC-V 32/64
- [x] 容器输出：ELF32 / ELF64 / Mach-O / PE-COFF / wasm
- [x] 目标覆盖：Linux / macOS / Windows × x86-64 / aarch64 + 裸机 ARM / RISC-V + wasm32
- [x] 标准库：core / io / string / collections / async / error / net / simd

## v0.6.0（计划中） 🚧

把现有框架变成真正能用的实现。

- [ ] 完整的真实指令选择（覆盖所有 IR 操作码）
- [ ] 真正的线性扫描寄存器分配
- [ ] 所有优化 pass 的完整实现
- [ ] `comptime` 编译期求值
- [ ] 属性系统完善

## v0.7.0（计划中） 📋

工具链成型。

- [ ] 增量编译（只重新编译变更的模块）
- [ ] 更多架构：wasm64 / Thumb-2
- [ ] 更多平台：FreeBSD / Android / iOS
- [ ] 32 位目标的多字长（i64）算术
- [ ] 包管理器 `zr pkg`
- [ ] 格式化器 `zr fmt`
- [ ] 语言服务器（LSP）

## v1.0.0（目标） 🎯

- [ ] API 稳定
- [ ] 完整的异步运行时
- [ ] **自举** —— 用 zr 重写 zr 编译器
- [ ] 性能基准达标（接近 Rust）

## 为什么先做这些

**v0.6 优先后端而非语法。** zr 已有 11 个目标，但每个目标的指令选择都还有缺口。
在这些缺口补齐之前，继续加语法只会扩大前端与后端的语义差距。

**自举排在 v1.0 而不是更早。** 自举要求语言在泛型、trait、错误处理、
`comptime` 上都足够稳定，否则会陷入「为了通过自举测试而扭曲语言」的循环。
先让外部程序用好 zr，再用 zr 写 zr。

**工具链先于生态。** 没有格式化器和 LSP，社区贡献的门槛会非常高，
代码风格也难以统一。

## 参与

路线图上的每一项都可以被认领。见 [贡献指南](/community/contributing/)。

版本发布记录见 [博客](/blog/)。