---
title: 学习 zr
description: 从安装到并发，系统地了解 zr 是一门什么样的语言，以及它为什么这样设计。
sidebar: learn
prev: null
next:
  title: 安装与第一个程序
  url: /learn/getting-started/
---

zr 是一门静态类型、编译型、系统级编程语言。这套教程从「怎么跑起来」讲到
「为什么这样设计」，你不需要任何 Rust 或 Zig 背景。

## 三分钟版本

如果你只想快速看一眼 zr 长什么样，这是整个语言的核心：

```rust
use io::{println, println_int};

// 所有权：每个值有且只有一个所有者
fn consume(s: String) -> usize {
    return s.len();          // s 在这里被销毁
}

fn main() -> i32 {
    let mut total = 0;

    // 类型推导 + 可变绑定
    let mut v = Vec::new();
    v.push(10);
    v.push(32);

    for item in &v {
        total += item;
    }

    // 模式匹配 + 解构
    let Pair(a, b) = (total, v.len());
    println("sum =");
    println_int(a);

    // 所有权转移
    let owned = String::from_bytes("zr");
    let len = consume(owned);
    println_int(len);

    return 0;
}
```

## zr 的三个关键词

| 关键词 | 含义 | 与谁相似 |
|:-------|:-----|:---------|
| **安全** | 内存安全由编译器证明，不依赖 GC | Rust |
| **显式** | 每个内存操作与所有权转移都看得见 | Zig |
| **可读** | 缩进无关、最小标点、单一惯用法 | Python |

这三者通常互相冲突：安全往往意味着抽象（看不见），显式往往意味着啰嗦（不好看）。
zr 的做法是把抽象放进**编译期**，把简洁放进**语法**：

- 泛型、trait、生命周期、闭包 —— 全部在编译期展开，运行时零痕迹（零成本抽象）。
- `Result` + `?` 让错误传播保持**线性**，但不打断阅读的节奏。
- 协程、`async`/`await`、通道作为语言原语，因此并发代码读起来就是顺序代码。

## 建议的学习路径

1. **[安装与第一个程序](/learn/getting-started/)** — 构建编译器，编译并运行 `hello.zr`，再编译一个交叉目标。
2. **[语法速览](/learn/syntax/)** — 变量、类型、控制流、函数、结构体、枚举、匹配、错误、泛型、闭包。
3. **[所有权与借用](/learn/ownership/)** — 语言的心脏：三条所有权规则与借用检查器。
4. **[类型与 trait](/learn/types/)** — Hindley-Milner 类型推导、trait 约束求解、单态化。
5. **[错误处理](/learn/errors/)** — `Result`、`?`、上下文与组合子。
6. **[异步与协程](/learn/async/)** — 一等协程、`async`/`await`、`join` / `race`、通道。
7. **[comptime 编译期求值](/learn/comptime/)** — 编译期计算与类型反射。
8. **[嵌入式与交叉编译](/learn/embedded/)** — 裸机 ARM / RISC-V 与 C 互操作。

## 编译器内部是怎么工作的

如果你对「这些是怎么做到的」感兴趣，编译器架构页面描述了完整的流水线：

```
源码 (.zr) → Lexer → Parser → AST → Type Checker → HIR → MIR → SSA
          → Optimizer → Code Generator → ELF / Mach-O / PE-COFF / wasm
```

详见 [编译器架构](/tools/architecture/)。