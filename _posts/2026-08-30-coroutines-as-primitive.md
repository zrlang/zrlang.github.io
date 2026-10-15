---
title: 协程是语言原语，不是库胶水
date: 2026-08-30
section: blog
author: zr Language Team
tags: [async, design, runtime]
description: 在很多语言里 async 是语法之上的宏。zr 把它放进语言与运行时，因此可以被类型系统检查，也更容易优化。
excerpt: 把 await 做成语法、把 join/race 做成原语，换来可检查、可优化的并发，以及结构化的取消。
---

「异步」这个词在不同语言里指的东西并不相同。在一些语言里，它是库在语法之上
做的一层宏；在另一些语言里，它是运行时的一个对象。zr 选了后者。

## 三种做法

| 做法 | 代表 | 问题 |
|:-----|:-----|:-----|
| 库 + 宏 | Rust（`async` / `.await` + `async-trait`） | 宏展开产生的代码难以调试，trait 被破坏 |
| 语法糖 + 库 | Go（`go` 关键字 / C# async） | 生成的状态机不可见，出问题难查 |
| 语言原语 | **zr**、`await`、`join` / `race` | 编译器工作量更大 |

## 原语带来了什么

### 可被类型系统检查

`join`、`race` 是普通函数，不是宏。你传错了参数个数，编译器会直接报错；
你把非 `Future` 传进去，也会被拒绝。

```rust
let (a, b) = await join(task1, task2);
let first  = await race(task1, task2);
let all    = await try_join_all(tasks);
```

### 可被优化

状态机改写是编译器内部的一步，不是展开进你的代码：

```
async fn 源码 → MIR 上的状态机 → SSA → 优化 pass → 机器码
```

`await` 本身不产生任何运行时开销；你为并发付的钱只有真正需要缓冲的地方
（比如通道的环形缓冲）。

### 结构化的取消

Future 是一个值。**丢弃它就是取消**：

```rust
let transfer = download(conn, 1024 * 1024);

if too_slow() {
    return Err(TooSlow);   // transfer 在此离开作用域 —— 操作取消，连接关闭
}
await transfer;
```

不需要 `cancel_token`，不需要 `AbortController`。资源的释放绑在值的生命周期上，
而生命周期是编译器能证明的东西。

## 通道与无数据竞争

```rust
let (tx, rx) = channel<i32>(16);
spawn(producer(tx));
let value = await rx.recv();
```

`tx` 被**移动**进生产者协程，所以别的协程不可能同时发送 —— 这是所有权系统
给出的保证，不是运行时加锁。有界容量让背压显式化，不会无限吃内存。

## 代价

诚实地讲，语言原语意味着编译器要负责：

- 协程栈的分配与切换
- 状态机的生成与优化
- 跨挂起点的存活分析

这些工作量不小。但它们本来就必须有人做 —— 与其让库去做，不如让编译器做，
因为只有编译器知道跨挂起点之后，哪些值还活着、哪些必须被移动。

详见 [异步与协程](https://zrlang.github.io/learn/async/)。