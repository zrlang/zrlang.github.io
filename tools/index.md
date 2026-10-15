---
title: 工具链
description: zr 编译器自带后端，命令行驱动，构建脚本会按目标产出对应的运行时库。
sidebar: tools
prev: null
next:
  title: 命令行参考
  url: /tools/cli/
---

zr 的工具链是一个自包含的可执行文件：`zr`。它自带词法分析、类型检查、
优化与**机器码生成后端**，不依赖 LLVM，也不依赖运行时库来完成自身构建。

## 设计取舍

| 选择 | 收益 | 代价 |
|:-----|:-----|:-----|
| 自研代码生成后端 | 编译速度可控、交叉编译只需要 C 工具链、可产出裸机映像 | 后端代码量巨大 |
| 单态化泛型 | 零成本抽象、产物等同手写 C | 二进制体积随泛型实例数增长 |
| 静态链接运行时（默认） | 产物可移植、无版本冲突 | 每个目标都要有对应运行时 |
| 无独立包管理器（规划中） | 早期阶段保持简单 | — |

## 命令概览

zr 是**单文件编译器，没有子命令**：

```bash
zr app.zr -o app              # 编译并链接
zr app.zr -c -o /dev/null     # 只做检查，不产出文件
zr app.zr --target wasm32-unknown-unknown -o app.wasm
zr program.zr --dump-ssa      # 看中间表示
```

zr 仓库 README 里的 `zr build` / `check` / `run` / `test` / `fmt` / `doc`
与 `zr link` 都还是**规划**（`zr pkg`、`zr fmt` 排在 v0.7.0）。
完整选项与规划中的子命令见[命令行参考](/tools/cli/)。

## 运行时库

zr 的运行时（`libzrrt-<平台>.a`）提供启动代码与平台原语：

- **Linux** —— `_start` 直接用系统调用退出进程。
- **macOS** —— `_start` 转发到 libSystem。
- **Windows** —— `_start` 调用 `ExitProcess`。
- **裸机** —— semihosting 调试输出 + 停在自循环。
- **wasm32** —— 通过模块导入（`zr.*`）提供能力。

`build.rs` 会在构建编译器时为**每一个当前可用的目标**产出运行时库。
缺少对应交叉工具链时该目标会被安静跳过 —— 编译器本身因此可以在没有交叉
工具链的机器上构建。

## 标准库

标准库完全用 zr 自己编写（自举方向），通过 `extern "C"` 链接系统调用：

```
std/
├── core.zr         // Option / Result / trait / panic / 数值工具
├── mem.zr          // alloc / dealloc / memcpy / memmove / Layout
├── io.zr           // 格式化输出与基础 IO
├── string.zr       // 可增长的 UTF-8 字符串
├── slice.zr        // 切片工具与迭代器
├── collections.zr  // Vec<T> 动态数组
├── async.zr        // 协程、Future、执行器、通道
├── error.zr        // 错误处理、回溯、断言
├── net.zr          // 套接字
└── simd.zr         // SIMD 内建
```

模块级说明见 [标准库](/std/)。

## 继续阅读

- [命令行参考](/tools/cli/) —— 所有命令与选项
- [支持的目标平台](/tools/targets/) —— 11 个目标的完整矩阵
- [编译器架构](/tools/architecture/) —— 从源码到机器码的完整流水线