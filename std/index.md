---
title: 标准库
description: zr 的标准库完全用 zr 自己编写，通过 extern "C" 链接系统调用。
sidebar: null
prev: null
next: null
---

zr 的标准库**完全用 zr 自身编写**，通过 `extern "C"` 链接系统调用。
每个模块都可以单独阅读，理解它也能帮你理解语言本身。

> **⚠️ 当前状态**：`std/` 里目前还有模块编译不过（例如 `mem.zr`），
> 因此带 `use` 的程序暂时可能失败。见[教程概览](/learn/)的实现状态。
> 编译器对标准库采用**按需加载**：写了 `use io::println` 才去 `std/io.zr`
> 加载 `io`，并递归处理它自己的 `use`；没用到的模块不会被编译。

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
use std::mem::{
    alloc, dealloc, Layout, Allocator, SystemAllocator,
    memset, memcpy, memmove, memcmp, memswap,
    transmute, zeroed, forget, drop,
    size_of, align_of, box_new, box_free,
    Slice, SliceMut, NULL, is_null, offset,
};
```

`Layout` 把「大小 + 对齐」打包成一个值，`alloc` 返回与之匹配的指针，
分配与释放必须用同一份 `Layout`：

```rust
let layout = Layout::new::<i32>();
let p = alloc(layout);
dealloc(p, layout);
```

`Allocator` trait 与 `SystemAllocator` 让全局分配器可以被替换。

## std::io

格式化输出与缓冲写入：

```rust
use std::io::{
    println, print, eprintln,          // 打印
    println_int, println_uint, print_int, print_uint,
    println_char, print_char,
    print_bool, eprint, print_hex_int,
    print_fmt, FormatArg,              // 格式化
    BufWriter,                          // 缓冲写入
    write_bytes, write_byte, write_char,
    write_hex, write_cstr,
    exit,
};
```

zr 没有 `println!` / `format!` 宏，格式化输出走 `print_fmt`：

```rust
use io::{print_fmt, FormatArg};

print_fmt("{} + {} = {}\n", &[
    FormatArg::Int(40), FormatArg::Int(2), FormatArg::Int(42)
]);
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

切片上的自由函数、迭代器与区间：

```rust
use std::slice::{len, is_empty, first, last, get, index_of, contains};
use std::slice::{reverse, copy, fill, sort, binary_search};
use std::slice::{map, filter, fold, sum, max, min, reduce, any, all, find};
use std::slice::{SliceIter, Range, range_step};
```

注意切片上的长度用 `s.len`（**不带括号**，它是切片自身的字段），
而 `Vec` / `String` 的 `len()` 是方法。`Slice` 与 `SliceMut` 这两个视图类型
定义在 `std::mem` 里，不在 `std::slice` 里。

高阶函数的参数是**函数指针**而不是闭包（闭包尚未实现）：

```rust
pub fn map<T, U>(s: []const T, f: fn(T) -> U) -> []U
pub fn filter<T: Copy>(s: []const T, pred: fn(T) -> bool) -> []T
pub fn fold<T, Acc>(s: []const T, init: Acc, f: fn(Acc, T) -> Acc) -> Acc
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
    Future, Poll, Ready, ready,
    Executor, Task, TaskState,
    spawn, run_all, yield_now, now_ms,
    channel, Channel, Sender, Receiver,
    Join2, Race, Wake, Waker, Context,
};

let mut ex = Executor::new();
ex.spawn(worker_frame());
ex.block_on(main_future());
ex.run();
```

`Channel` 提供 `send` / `recv` / `len` / `is_empty`；
`Join2` 与 `Race` 是组合子。说明见 [异步与协程](/learn/11-concurrency/)。

## std::error

错误处理、回溯与断言：

```rust
use std::error::{
    Error, Backtrace,
    report_fatal, report,
    with_context, ensure, assert, assert_eq,
};
```

说明见 [错误处理](/learn/06-errors/)。

## std::net

套接字封装（TCP / UDP）：

```rust
use std::net::{
    TcpListener, TcpStream, UdpSocket, Socket, SocketAddr,
    AddrFamily, Ipv4Addr, Ipv6Addr,
    HttpMethod, HttpStatus, HttpResponse, HttpHeader,
    http_get, http_request, tcp_connect, fetch,
    lookup_host, parse_ipv4, parse_ipv6, parse_socket_addr,
    NetError,
};

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
use std::simd::{f32x4, i32x4, f64x2, i8x8};

// 一次处理 4 个 i32
let a = i32x4::from_array([1, 2, 3, 4]);
let b = i32x4::from_array([5, 6, 7, 8]);
let out = (a + b).to_array();
```

`#[repr(simd)]` 可以要求向量布局。

## 自举

标准库本身不使用 `unsafe` 之外的高级技巧，所有平台相关的部分集中在 `extern "C"`
声明里。这意味着：

- 换一个目标平台，只需要替换 `extern "C"` 的实现。
- 标准库代码同时是 zr 语言可用性的活文档。

> **稳定性**：标准库 API 在 v1.0 之前仍可能变动。当前请以仓库中的 `std/` 源码为准。