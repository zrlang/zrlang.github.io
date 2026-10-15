---
title: 异步与协程
description: zr 把协程作为语言原语：async/await、join / race 组合子、通道，以及零成本的执行器。
sidebar: learn
prev:
  title: 错误处理
  url: /learn/errors/
next:
  title: comptime 编译期求值
  url: /learn/comptime/
---

在许多语言里，「异步」是库在语法之上做的一层糖。zr 把它放进语言与运行时：
协程栈由编译器分配，`await` 由编译器改写，调度由 `std::async` 的执行器负责。

## 异步函数

```rust
async fn fetch(url: &str) -> Result<Response, Error> {
    let conn = await connect(url)?;
    let req  = await conn.send_request()?;
    return await req.read_response();
}
```

`async fn` 的返回类型是一个 **Future** —— 一个描述「将来会算出什么」的惰性状态机。
它不会在调用时立刻执行，而是等到被 `await` 或被交给执行器时才推进。

## 并发组合子

`std::async` 提供三类组合子：

```rust
// join：等待全部完成
let (a, b) = await join(task1, task2);

// race：谁先就绪就用谁
let first = await race(task1, task2);

// try_join_all：全部成功才成功，任一失败立即失败
let all = await try_join_all(tasks);
```

### 一个完整的例子

```rust
use async::{join, race, spawn, channel, Executor};

/// 一个异步的 TCP 回声处理器
async fn echo(conn: &mut Connection) -> Result<(), IoError> {
    let mut buf = [0u8; 1024];
    loop {
        let n = await conn.read(&mut buf);
        if n == 0 { break; }
        await conn.write(&buf[0..n]);
    }
    return Result::Ok(())
}

/// 主程序：同时服务多个连接
async fn serve(addr: &str) -> Result<(), IoError> {
    let listener = await listen(addr)?;
    loop {
        let conn = await listener.accept()?;
        spawn(echo(conn));           // 每个连接一个协程
    }
}

fn main() -> i32 {
    let mut ex = Executor::new();
    ex.block_on(serve("0.0.0.0:8080"));
    return 0;
}
```

注意 `serve` 的循环体里**没有任何回调、事件循环或绿色线程**。并发只是把 `await`
看成「这里可能挂起」，剩下的交给编译器与执行器。

## 通道

通道是协程之间传递所有权的方式，配合所有权系统天然无数据竞争：

```rust
let (tx, rx) = channel<i32>(16);      // 容量 16 的有界通道

spawn(producer(tx));                  // 发送方协程

// 接收方
let value = await rx.recv();
match value {
    Option::Some(v) => println_int(v),
    Option::None    => close(),
}
```

要点：

- **发送所有权** —— `tx` 被移进生产者协程，别的协程不可能同时发。
- **有界** —— 容量写死，背压是显式的，不会无限吃内存。
- **无数据竞争** —— 每个值只有一个发送者、一个接收者，编译器可以证明。

## 手动让出执行权

在协程内部，耗时而不需要 I/O 的循环应该主动让出：

```rust
async fn compute(n: i32) -> i32 {
    var i = 0;
    var total = 0;
    while i < n {
        total += i * i;
        i += 1;

        if i % 10000 == 0 {
            await yield_now();     // 让出，避免饿死其他协程
        }
    }
    return total;
}
```

`await sleep(ms)` 则用于定时等待。

## 取消

Future 是一个状态机，**丢弃它就等于取消**：

```rust
let conn = await connect(url)?;
let transfer = download(conn, 1024 * 1024);

if too_slow() {
    // transfer 在这里离开作用域 —— 操作被取消，连接被关闭
    return Err(TooSlow);
}
await transfer;
```

没有额外的 `cancel_token`、没有 `AbortController` —— 结构化并发的力量在于：
资源的释放绑在值的生命周期上。

## 零成本的部分

不是所有 `async` 都是零成本的。zr 的取舍是：

| 部分 | 成本 |
|:-----|:-----|
| 状态机改写 | 编译期完成，运行时无痕迹 |
| 协程栈 | 首次挂起时分配，之后复用 |
| `join` / `race` | 编译为一次状态判断 + 跳转 |
| 通道 | 显式的堆分配（环形缓冲） |

也就是说，**状态机本身是免费的**，你为并发付的钱只有真正需要缓冲的地方。

## 与其他语言的区别

| | zr | Rust | Go | Python |
|:--|:---|:-----|:--|:-------|
| 协程 | 语言原语 | 需要宏 / 库 | `go` 关键字 | `async`/`await`（单线程） |
| `await` | `await expr` | `.await` | 隐式（阻塞即让出） | `await expr` |
| 并发组合子 | `join` / `race` | `join!` / `select!` | `WaitGroup` / `select` | `asyncio.gather` |
| 取消 | 丢弃 Future | 丢弃 Future | 依赖 context | `task.cancel()` |

zr 的选择是：**把 `await` 与组合子做成语法与标准库原语，而不是宏**，
这样它们可以被类型系统检查，也更容易优化。

## 下一步

- 编译期计算 → [comptime 编译期求值](/learn/comptime/)
- `std::async` 的完整 API → [标准库](/std/)