---
title: 标准库
description: zr 的标准库完全用 zr 自己编写，通过 extern "C" 链接系统调用。
sidebar: null
prev: null
next: null
---

zr 的标准库**完全用 zr 自身编写**，通过 `extern "C"` 链接系统调用。
每个模块都可以单独阅读，理解它也能帮你理解语言本身。

```
std/
├── core.zr         // 基础类型：Option / Result / trait / panic / 数值工具
├── mem.zr          // 内存管理：alloc / dealloc / memcpy / memmove / Layout
├── io.zr           // 格式化输出与基础 IO
├── string.zr       // 可增长的 UTF-8 字符串
├── slice.zr        // 切片工具、迭代器、高阶函数
├── collections.zr  // Vec<T> 动态数组
├── async.zr        // 协程、Future、执行器、通道
├── error.zr        // 错误处理、回溯、断言
├── net.zr          // 套接字
└── simd.zr         // SIMD 内建
```

## 使用方式

```rust
// 引入整个模块
use std::io;
io::println("hello");

// 选择性导入
use std::collections::Vec;
use std::string::String;

// 通配符导入
use std::math::*;
```

## std::core

基础类型与诊断工具：

```rust
use std::core::{
    Option, Result,        // 可选值与结果
    Eq, Ord, Copy, Clone, // 核心 trait
    Display, Debug,       // 格式化 trait
    panic, assert,        // 诊断工具
    min, max, clamp,      // 数值工具
};
```

## std::mem

内存管理原语：

```rust
use std::mem::{alloc, dealloc, Layout, memcpy, memmove, size_of, align_of};
```

`Layout` 把「大小 + 对齐」打包成一个值，`alloc` 返回与之匹配的指针：

```rust
let layout = Layout::new::<i32>();
let p = alloc(layout);
dealloc(p, layout);
```

## std::io

格式化输出与缓冲写入：

```rust
use std::io::{
    println, print, eprintln,        // 打印
    print_int, print_uint, print_float,
    print_bool, print_char, print_fmt,
    BufWriter,                        // 缓冲写入
    write_bytes, write_byte,
};
```

注意 zr 的 IO 是**显式函数**而不是方法链 —— `println(x)` 而不是 `x.println()`，
这样在嵌入式目标上可以整体替换掉。

## std::string

可增长的 UTF-8 字符串：

```rust
use std::string::String;

let mut s = String::new();
s.push_byte(b'h');
s.push_str(&other);
s.push_int(42);

let len = s.len();
let sub = s.substr(0, 5);
let found = s.find_byte(b'x');
```

`&str` 是 `[]const u8` 的切片视图，传递它不发生拷贝。

## std::slice

切片工具与迭代器：

```rust
use std::slice::{Slice, Iter};

fn sum(values: []const i32) -> i32 {
    return values.iter().fold(0, |acc, x| acc + x);
}
```

## std::collections

`Vec<T>` 动态数组：

```rust
use std::collections::Vec;

let mut v = Vec::new();
v.push(1);
v.push(2);

let first = v.get(0);
v.insert(1, 99);
v.remove(0);
v.sort();
```

## std::async

协程、Future、执行器与通道：

```rust
use std::async::{
    Executor, Task,
    spawn, yield_now, sleep,
    channel, Sender, Receiver,
    join, race, try_join_all,
};

let mut ex = Executor::new();
ex.spawn(worker_task());
ex.block_on(main_future());
ex.run();
```

组合子说明见 [异步与协程](/learn/async/)。

## std::error

错误处理、回溯与断言：

```rust
use std::error::{
    Error, Backtrace,
    report_fatal, report,
    with_context, ensure, assert, assert_eq,
};
```

说明见 [错误处理](/learn/errors/)。

## std::net

套接字封装（TCP / UDP）：

```rust
use std::net::{TcpListener, TcpStream, SocketAddr};

async fn serve(addr: SocketAddr) -> Result<(), IoError> {
    let listener = TcpListener::bind(addr)?;
    loop {
        let (conn, peer) = await listener.accept()?;
        spawn(handle(conn));
    }
}
```

## std::simd

SIMD 内建，用于数据密集型循环：

```rust
use std::simd::{Simd, lane_count};

// 一次处理 4 个 i32
let a = Simd::splat(3);
let b = Simd::load(&data);
return (a * b).store(&mut out);
```

## 自举

标准库本身不使用 `unsafe` 之外的高级技巧，所有平台相关的部分集中在 `extern "C"`
声明里。这意味着：

- 换一个目标平台，只需要替换 `extern "C"` 的实现。
- 标准库代码同时是 zr 语言可用性的活文档。

> **稳定性**：标准库 API 在 v1.0 之前仍可能变动。当前请以仓库中的 `std/` 源码为准。