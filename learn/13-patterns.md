---
title: 13. 模式匹配
description: match 与 if let、解构、匹配守卫——zr 里表达「不同形状的数据」的统一手段。
sidebar: learn
status: partial
status_note: match 已脱糖成 if/else 链并有完整运行期语义：字面量、_、绑定臂、 或模式、guard，以及 bool 穷尽时不写尾 _（用例 25_match.zr）。 完整的模式形态（枚举 / 结构体 / 元组解构、范围）尚未实现。
prev:
  title: 12. 面向对象特性
  url: /learn/12-oop/
next:
  title: 14. 高级特性
  url: /learn/14-advanced/
---

模式匹配不只是「对一个值做分支」，它同时是**解构工具**、**状态检查器**和
**穷尽性验证器**。zr 的编译器把「忘记处理某个分支」当成错误，这是它消灭
一整类 bug 的关键设计。

> **⚠️ 当前状态**：`match` 已脱糖成 if/else 链并有运行期语义（用例 `25_match.zr`），
> 支持字面量（含负数与 `char`）、`_`、绑定臂、或模式、`guard`，
> 以及 bool 穷尽时不写尾 `_`。本章里出现的**枚举、结构体、元组解构与范围模式
> 尚未实现**；`while let` 解析器里也没有。

## `match` 的结构

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

每个分支是「模式 => 表达式」。编译器从上到下匹配，命中即停。

## 字面量与范围

```rust
fn classify(status: i32) -> []const u8 {
    return match status {
        200         => "OK",
        300..=399   => "Redirect",
        400..=499   => "Client Error",
        500..=599   => "Server Error",
        _           => "Unknown",
    };
}
```

`a..b` 是半开区间（含 `a` 不含 `b`），`a..=b` 是闭区间。

## 或模式

```rust
match c {
    'a' | 'e' | 'i' | 'o' | 'u' => "元音",
    _                           => "辅音",
}
```

或模式的绑定必须一致 —— 两个分支里绑定的变量集合要相同。

## `Option` 与 `Result`

最常见的两个用途：

```rust
let some = Option::Some(42);
match some {
    Option::Some(n) => println_int(n),
    Option::None    => println("nothing"),
}

let r = parse(input);
match r {
    Result::Ok(v)    => use_value(v),
    Result::Err(err) => report(err),
}
```

注意 `Option::Some(n)` 里的 `n` 是**按值绑定** —— `Some` 拥有那个值，
所以分支内可以直接用它，不需要 `*`。

## `if let` 与 `while let`

只关心一种形状时，`if let` 比写一个只有一个分支的 `match` 更清楚：

```rust
if let Option::Some(v4) = parse_ipv4(host_slice) {
    // 只有匹配到 Some 才进来
    connect(v4);
}
```

`std/net.zr` 里有多处这种写法：

```rust
if let Option::Some(a) = SocketAddr::from_storage(addr_ptr) {
    return Result::Ok(a);
}
```

`while let` 让循环在模式不再匹配时自动退出：

```rust
while let Some(line) = reader.next_line() {
    println(line);
}
```

zr 的解析器里目前只找到 `if let` 的实现，`while let` 尚未支持。

## 解构

### 解构元组

```rust
fn divmod(a: i32, b: i32) -> (i32, i32) {
    return (a / b, a % b);
}

let pair = divmod(17, 5);
match pair {
    (0, r) => println_int(r),
    (q, 0) => println_int(q),
    (q, r) => { /* 两者都有 */ },
}
```

### 解构结构体

```rust
struct Point {
    x: i32,
    y: i32,
}

let p = Point { x: 1, y: 2 };

match p {
    Point { x: 0, y: 0 } => println("原点"),
    Point { x, y }       => println("坐标"),
}
```

注意第二个分支的 `x` 和 `y` 是**变量绑定**，不是字段比较 ——
`Point { x, y }` 匹配任意值并绑定它们。

### 解构枚举

```rust
pub enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(u8, u8, u8),
}

fn describe(msg: Message) -> String {
    return match msg {
        Message::Quit                 => "退出",
        Message::Move { x, y }        => "移动",
        Message::Write(text)          => "写入",
        Message::ChangeColor(r, g, b) => "换色",
    };
}
```

### 嵌套模式

```rust
match payload {
    Message::Move { x: 0, y: 0 } => "不动",
    Message::Move { x, y }       => "动了",
    other                        => describe(other),
}
```

### `@` 绑定与子模式

当你想同时用值和子模式时，用 `@`：

```rust
match status {
    s @ 200..=299 => "成功",        // s 绑定整个值
    _             => "其他",
}
```

## 匹配守卫

守卫是作用在**已经匹配成功的变量绑定**上的额外布尔条件：

```rust
match value {
    n if n % 15 == 0 => "FizzBuzz",
    n if n % 3 == 0  => "Fizz",
    n if n % 5 == 0  => "Buzz",
    n                => "数字",
}
```

Rust 里守卫不能有副作用，zr 也遵循这个限制 —— 它们决定的是「走哪个分支」，
不是「执行什么」。需要副作用就用 `if` 提前分支。

## 穷尽性检查

`match` 必须覆盖所有可能，否则是编译错误：

```rust
enum State { Idle, Running, Done }

match state {
    State::Idle    => run(),
    State::Running => wait(),
    State::Done    => finish(),
    // 缺少 State::Done —— 编译器会报错
}
```

这条规则消灭了一整类「加了新变体但忘了处理」的运行时 bug。
它之所以可行，是因为编译器知道枚举的全部变体 —— 这也是 zr 用枚举而不是
「整数标签 + 联合体」的一个理由。

## `@`、范围、或模式可以组合

```rust
match n {
    1 | 2 | 3 | 4 | 5 => "小",
    v @ 10..=20        => "中",
    v if v < 0        => "负",
    _                  => "大",
}
```

分支的书写顺序就是优先级，从上到下。

## 让 `match` 作为表达式

```rust
let label = match code {
    200 => "OK",
    _   => "ERROR",
};

// 也能用在分支表达式里
let body = if flag { 1 } else { 0 };
```

`match` 在 zr 里是需要显式 `return` 的普通表达式，因此和函数返回一致。
但 `match` 作为表达式**依赖分支合流**（需要 φ 节点），
而这正是当前编译器尚未实现的部分。

## 小结

| 能力 | 语法 | 状态 |
|:-----|:-----|:-----|
| 字面量分支 | `200 => "OK"` | 设计完成 |
| 范围 | `1..=10 =>` | 设计完成 |
| 或模式 | `12 \| 24 =>` | 设计完成 |
| 通配符 | `_ =>` | 设计完成 |
| 元组 / 结构体 / 枚举解构 | `Point(x, y) =>` | 设计完成 |
| `@` 绑定 | `s @ 200..=299 =>` | 设计完成 |
| 匹配守卫 | `n if n > 100 =>` | 设计完成 |
| 穷尽性检查 | 缺分支 = 编译错误 | 设计完成 |
| `match` 表达式 | `let x = match v { ... }` | 依赖 φ 节点 |
| `if let` | `if let Some(v) = e { }` | 已在 std 中使用 |
| `while let` | `while let Some(v) = e { }` | 解析器未实现 |

下一章：[14. 高级特性](/learn/14-advanced/)。