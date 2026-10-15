---
title: 11. 并发编程
description: zr 没有线程，有一等协程。async/await、组合子与通道，以及与 Rust 并发模型的对照。
sidebar: learn
status: planned
status_note: 线程、<code>Mutex</code>、<code>Send</code> / <code>Sync</code> 尚未实现。
prev:
  title: 10. 智能指针
  url: /learn/10-pointers/
next:
  title: 12. 面向对象特性
  url: /learn/12-oop/
---

Rust 的并发建立在操作系统线程上。**zr 完全没有线程** —— 它把并发做成了
一等协程：语言原语，而不是库胶水。

> **⚠️ 当前状态**：线程、`Mutex`、`Send` / `Sync` 尚未实现；
> `std/async.zr` 的运行时模块目前仍编译不过。本章是设计说明。

## zr 没有线程

| 能力 | Rust | zr |
|:-----|:-----|:----|
| 操作系统线程 | `thread::spawn` | ✘ |
| 线程同步 | `Mutex` / `RwLock` | ✘ |
| 可跨线程的标记 | `Send` / `Sync` | 内建 trait，无实现方 |
| 消息传递 | `mpsc::channel` | `Channel<T>` ✔ |
| 任务 | `Future` + 执行器 | `Future` + `Executor` ✔ |
| 轻量并发 | `async` / `await` | `async` / `await` ✔ |
| 并发组合子 | `join!` / `select!` | `Join2` / `Race` ✔ |

`Send`、`Sync`、`Unpin`、`Sized` 在 zr 的类型检查器里被特判为**内建 auto trait**
（`src/typeck/mod.rs` 的 `classify_trait`），标记为 `auto + marker`，
自动对满足条件的类型成立。因为没有线程，它们目前不需要任何手动实现。

zr 的取舍很明确：**系统级语言需要的是可预测的并发，而不是抢占式调度。**
协程栈由编译器分配、切换由编译器改写、`Send`/`Sync` 无关，
整套模型比线程简单一个数量级。

代价是：**目前写不了多核并行的 CPU 密集任务**。

## `async` / `await`

```rust
async fn fetch(url: &str) -> Result<Response, Error> {
    let conn = await connect(url)?;
    let req  = await conn.send_request()?;
    return await req.read_response();
}
```

`async fn` 返回一个 **Future** —— 描述「将来会算出什么」的惰性状态机。
调用它不会执行任何东西，要等到被 `await` 或交给执行器。

```rust
pub trait Future {
    type Output;
    fn poll(self: &mut Self) -> Poll<Self::Output>;
}

pub enum Poll<T> {
    Ready(T),
    Pending,
}
```

`Poll` 是 Future 的核心：要么算完了（`Ready`），要么还没（`Pending`，
同时保证下次被唤醒）。这个协议和 Rust 完全一致，所以 `Waker` / `Context` /
`Wake` 的设计文档（`future/async_await/waker_integration.md`）直接沿用。

## 组合子

`std/async.zr` 提供两类组合子：

```rust
// Join2：等全部完成，输出是元组
let (a, b) = await join(task1, task2);

// Race：谁先就绪用谁
let first = await race(task1, task2);
```

| 组合子 | 语义 | 输出 |
|:-------|:-----|:-----|
| `Join2<F1, F2, O1, O2>` | 全部完成 | `(O1, O2)` |
| `Race<F1, F2, O>` | 第一个就绪的 | `O` |

```rust
impl<F1, F2, O1, O2> Future for Join2<F1, F2, O1, O2> {
    fn poll(self: &mut Self) -> Poll<(O1, O2)> { /* ... */ }
}
```

它们是普通类型 + `Future` 实现，不是宏 —— 所以传错参数类型会被类型系统拒绝，
而且可以被优化器看到。

## 执行器

```rust
use async::{Executor, Task, spawn, run_all, block_on};

let mut ex = Executor::new();
ex.spawn(task_frame());
ex.block_on(main_future());
ex.run();
```

| API | 说明 |
|:----|:-----|
| `Executor::new()` | 创建执行器 |
| `Executor::spawn(frame) -> u64` | 注册一个任务 |
| `Executor::run()` | 驱动到没有可推进的任务 |
| `Executor::block_on(future)` | 阻塞直到该 future 完成 |
| `spawn(frame) -> u64` | 顶层快捷函数 |
| `run_all()` | 驱动全部任务 |

任务由 `Task` 结构表示，带 `TaskState` 状态机：

```rust
pub enum TaskState { ... }

impl Task {
    pub fn poll(self: &mut Task);
    pub fn is_ready(self) -> bool;
}
```

## 通道

通道是协程之间传递所有权的方式，配合所有权系统天然无数据竞争：

```rust
use async::{Channel, channel, Sender, Receiver};

let ch = Channel::new(16);            // 有界环形缓冲
ch.send(42);
let v = ch.recv();

println_int(ch.len() as i64);
println_bool(ch.is_empty());

// 或者拿一对收发端
let (tx, rx) = channel<i32>(16);
```

| 方法 | 说明 |
|:-----|:-----|
| `Channel::new(cap)` | 创建有界通道 |
| `send(value)` | 发送（阻塞直到有空位） |
| `recv()` | 接收（阻塞直到有值） |
| `len()` | 缓冲区中的元素数 |
| `is_empty()` | |

要点：

- **有界** —— 容量写死，背压是显式的，不会无限吃内存。
- **所有权** —— 发送的值被移动过去，别的协程不可能同时持有它。
- **无数据竞争** —— 借用检查器保证没有两个引用同时写同一个值。

标准库测试里就是这么用的：

```rust
let (tx, rx) = channel<i32>(16);
spawn(producer(tx));              // 发送方协程
let value = await rx.recv();     // 接收方
```

## 主动让出

在协程内部，耗时而不需要 I/O 的循环应该主动让出，否则会饿死其他协程：

```rust
async fn compute(n: i32) -> i32 {
    let mut i = 0;
    let mut total = 0;
    while i < n {
        total += i * i;
        i += 1;

        if i % 10000 == 0 {
            await yield_now();     // 让出
        }
    }
    return total;
}
```

`std/async.zr` 里还有 `now_ms() -> u64`（毫秒时间）和 `await_ready`。

## 一个完整的例子

```rust
use async::{Executor, spawn, channel, Channel};

/// 一个异步的 TCP 回声处理器
async fn echo(conn: &mut Connection) -> Result<(), IoError> {
    let mut buf = [0u8; 1024];
    loop {
        let n = await conn.read(&mut buf);
        if n == 0 { break; }
        await conn.write(&buf[0..n]);
    }
    return Result::Ok(());          // 出错时自动返回 Err
}

/// 主程序：每个连接一个协程
async fn serve(addr: &str) -> Result<(), IoError> {
    let listener = await listen(addr)?;
    loop {
        let conn = await listener.accept()?;
        spawn(echo(conn));
    }
}

fn main() -> i32 {
    let mut ex = Executor::new();
    ex.block_on(serve("0.0.0.0:8080"));
    return 0;
}
```

注意 `serve` 里**没有回调、没有事件循环、没有绿色线程**。并发只是把 `await`
看成「这里可能挂起」，剩下的交给编译器与执行器。

## 取消

Future 是值，**丢弃它就是取消**：

```rust
let conn = await connect(url)?;
let transfer = download(conn, 1024 * 1024);

if too_slow() {
    return Err(TooSlow);      // transfer 离开作用域 —— 操作取消，连接关闭
}
await transfer;
```

没有 `cancel_token`，也没有 `AbortController` —— 资源释放绑在值的生命周期上，
而生命周期是编译器能证明的东西。设计文档在 `future/async_await/pinning_and_move.md`。

## 成本

| 部分 | 成本 |
|:-----|:-----|
| 状态机改写 | 编译期完成，运行时无痕迹 |
| 协程栈 | 首次挂起时分配，之后复用 |
| `Join2` / `Race` | 编译为一次状态判断 + 跳转 |
| 通道 | 显式的堆分配（环形缓冲） |

**状态机本身是免费的**，你为并发付的钱只有真正需要缓冲的地方。

## 与 Rust 的对照

| | zr | Rust | Go | Python |
|:--|:---|:-----|:--|:-------|
| 协程 | 语言原语 | 需要宏 / 库 | `go` 关键字 | `async`/`await`（单线程） |
| `await` | `await expr` | `.await` | 隐式（阻塞即让出） | `await expr` |
| 组合子 | `Join2` / `Race` | `join!` / `select!` | `WaitGroup` / `select` | `asyncio.gather` |
| 取消 | 丢弃 Future | 丢弃 Future | 依赖 context | `task.cancel()` |
| 线程 | ✘ | ✔ | ✔ | ✔ |

zr 的选择是**把 `await` 与组合子做成语法与标准库原语，而不是宏** ——
这样它们可以被类型系统检查，也更容易优化。

## 小结

| 能力 | zr 现状 |
|:-----|:---------|
| `async` / `await` | 设计完成 |
| `Future` / `Poll` | ✔ `std/async.zr` |
| `Join2` / `Race` | ✔ |
| `Executor` / `Task` / `spawn` | ✔ |
| `Channel<T>` | ✔ |
| `Waker` / `Context` / `Wake` | ✔（设计文档标记为已完成） |
| `Pin<T>` / `!Unpin` | 设计文档标记为已完成 |
| 线程 / `Mutex` / `Arc` | ✘ |
| `Send` / `Sync` | 内建 auto trait，无线程所以无需实现 |

下一章：[12. 面向对象特性](/learn/12-oop/)。