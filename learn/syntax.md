---
title: 语法速览
description: 一页看完 zr 的全部语法：变量、类型、控制流、函数、结构体、枚举、匹配、错误、泛型、闭包、模块与属性。
sidebar: learn
prev:
  title: 安装与第一个程序
  url: /learn/getting-started/
next:
  title: 所有权与借用
  url: /learn/ownership/
---

这一页是 zr 语法的完整速查。想理解设计动机，请回到 [学习 zr](/learn/)。

## 变量与常量

```rust
let x: i32 = 42;            // 不可变绑定（默认）
let y = 3.14;               // 类型推导为 f64

var counter: i32 = 0;       // 可变绑定
counter += 1;

const PI: f64 = 3.141592653589793;   // 编译期常量
static mut GLOBAL: i32 = 0;          // 全局静态变量
```

> zr 用 `let` 表示不可变绑定、`var` 表示可变绑定 —— 不像 Rust 那样靠 `mut` 关键字区分。

## 基础类型

| 类别 | 类型 | 大小 |
|:-----|:-----|:-----|
| 有符号整数 | `i8` `i16` `i32` `i64` `i128` `isize` | 1 / 2 / 4 / 8 / 16 / 指针宽 |
| 无符号整数 | `u8` `u16` `u32` `u64` `u128` `usize` | 同上 |
| 浮点 | `f16` `f32` `f64` | 2 / 4 / 8 字节 |
| 布尔 | `bool` | 1 字节 |
| 字符 | `char` | 4 字节（Unicode 标量） |
| 指针 | `*const T` `*mut T` | 指针宽 |
| 引用 | `&T` `&mut T` | 指针宽 |

字符串切片写作 `&str`，可变字符串切片写作 `&mut []u8`。

## 控制流

```rust
// if 是表达式
let max = if a > b { a } else { b };

// while
while !done {
    step();
}

// for-in：基于迭代器
for i in 0..10 {
    println_int(i);
}

// loop + break / continue
loop {
    let n = next();
    if n == 0 { break; }
    if n < 0 { continue; }
}

// 带值的 break
let result = loop {
    if ready() { break compute(); }
    yield_now();
};
```

`if` / `match` / `loop` 都是表达式，可以产生值。

## 函数

```rust
/// 两点间的距离
pub fn distance(p1: Point, p2: Point) -> f64 {
    let dx = p1.x - p2.x;
    let dy = p1.y - p2.y;
    return (dx * dx + dy * dy).sqrt();
}

// 多返回值通过元组
fn divmod(a: i32, b: i32) -> (i32, i32) {
    return (a / b, a % b);
}

// 可变参数通过切片
fn sum(values: []const i32) -> i32 {
    let mut total = 0;
    let mut i = 0;
    while i < values.len {
        total += values[i];
        i += 1;
    }
    return total;
}

// 可变参数引用
fn fill(buf: []mut u8, value: u8) { /* ... */ }
```

`pub` 表示公开；默认私有。

## 结构体

```rust
// 元组结构体
pub struct Point(f64, f64);

// 具名字段
pub struct Rectangle {
    pub width:  f64,
    pub height: f64,
}

impl Rectangle {
    // 接收所有权
    pub fn area(self) -> f64 {
        return self.width * self.height;
    }

    // 接收可变引用，避免昂贵的拷贝
    pub fn scale(self: &mut Rectangle, factor: f64) {
        self.width  *= factor;
        self.height *= factor;
    }
}

// 结构体更新语法
let bigger = Rectangle { width: 100, ..smaller };
```

## 枚举

```rust
// 简单枚举
pub enum Color { Red, Green, Blue }

// 带载荷的枚举（tagged union）
pub enum Value {
    Int(i64),
    Float(f64),
    Text(String),
    List(Vec<Value>),
}

// 显式内存布局
#[repr(u8)]
pub enum Status {
    Pending = 0,
    Running = 1,
    Done    = 2,
}

#[repr(C)]
pub struct Packet { /* C 兼容布局 */ }
```

## 模式匹配

```rust
match value {
    0             => "zero",          // 字面量
    1..=10        => "small",         // 范围
    12 | 24 | 36  => "dozen",         // 或模式
    Point(x, y)   => "at a point",    // 解构
    n if n > 100  => "big",           // 守卫
    _             => "other",         // 通配符
}
```

`if let` 与 `while let` 用于「只关心一种形状」的场景：

```rust
if let Some(v) = map.get(key) {
    use_value(v);
}

while let Some(line) = reader.next_line() {
    println(line);
}
```

## 错误处理

```rust
pub fn parse(s: &str) -> Result<i32, ParseError> {
    // ...
}

// `?`：出错时自动向上传播
fn process(path: &str) -> Result<Data, Error> {
    let file = File::open(path)?;          // Err 时直接 return
    let text = file.read_to_string()?;
    let data = parse(&text)?;
    return Result::Ok(data);
}

// 补充上下文
let config = read_config("app.conf").context("failed to read config")?;

// 组合子
let value = parse(input).map(|v| v * 2).unwrap_or(0);
```

详见 [错误处理](/learn/errors/)。

## 泛型

```rust
// 泛型函数
fn swap<T>(a: &mut T, b: &mut T) {
    let tmp = *a;
    *a = *b;
    *b = tmp;
}

// trait 约束
fn largest<T: Ord + Copy>(slice: []const T) -> T {
    let mut m = slice[0];
    for item in slice[1..] {
        if item > m { m = item; }
    }
    return m;
}

// where 子句
fn process<T>(value: T) -> T
where T: Clone + Default
{
    // ...
}

// 关联类型
pub trait Iterator {
    type Item;
    fn next(self: &mut Self) -> Option<Self::Item>;
}
```

## 闭包

```rust
// 捕获外部变量
let factor = 3;
let multiply = |x: i32| x * factor;

// 高阶函数
fn apply_twice<T>(x: T, f: fn(T) -> T) -> T {
    return f(f(x));
}

// 用 impl Trait 接收闭包
fn call_with<T>(value: T, op: impl Fn(T) -> T) -> T {
    return op(value);
}
```

## 切片

```rust
// 切片是数组的视图，不发生拷贝
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    match bytes.find_byte(b' ') {
        Option::Some(pos) => &s[0..pos],
        Option::None       => s,
    }
}
```

## 模块与可见性

```rust
// 导入
use std::io::{println, print_fmt};
use std::collections::HashMap;

// 重命名
use std::string::String as StringBuilder;

// 可见性
pub struct PublicStruct {
    pub field: i32,           // 公开字段
    internal: i32,            // 私有（默认）
}

pub(crate) fn crate_local() {}   // 仅当前 crate 可见
pub(super)  fn parent_only() {}  // 仅父模块可见
```

## 属性

```rust
#[inline(always)]                      // 强制内联
fn hot_path() { /* ... */ }

#[link(name = "c", kind = "static")]   // 链接指令
extern "C" { /* ... */ }

#[test]                                // 标记为测试
fn test_basic() { /* ... */ }

#[repr(C, packed)]                     // 布局控制
struct Header { /* ... */ }

#[derive(Debug, Clone, Copy)]          // 自动派生（规划中）
struct Point { x: f64, y: f64 }
```

## 异步

```rust
async fn fetch(url: &str) -> Result<Response, Error> {
    let conn = await connect(url)?;
    let req  = await conn.send_request()?;
    return await req.read_response();
}

// 并发组合子
let (a, b) = await join(task1, task2);       // 等全部
let first  = await race(task1, task2);       // 等最快
let all    = await try_join_all(tasks);      // 任一失败即失败

// 通道
let (tx, rx) = channel<i32>(16);
spawn(producer(tx));
let value = await rx.recv();
```

详见 [异步与协程](/learn/async/)。