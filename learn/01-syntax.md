---
title: 1. 基础语法
description: 变量与可变性、标量与复合类型、函数与注释、控制流——zr 语言入门的地基。
sidebar: learn
status: partial
status_note: >-
  变量、标量与浮点、运算符、函数、递归、while / loop / break / continue、
  if 作为表达式、else if 链、as 转换、字面量类型后缀均已通过测试。
  当前唯一的语法缺口是 for —— a..b 区间表达式仍解析成标识符。
prev:
  title: 安装与第一个程序
  url: /learn/getting-started/
next:
  title: 2. 所有权系统
  url: /learn/02-ownership/
---

本章对应《Rust 程序设计语言》的「基础语法」。zr 在这里做了两处与 Rust 不同的选择，
其余保持一致。

## 变量与可变性

zr 用 `let` 声明绑定，用 `let mut` 表示该绑定之后可以重新赋值。

```rust
let x: i32 = 42;        // 不可变
let y = 3.14;           // 类型推导为 f64

let mut counter: i32 = 0;
counter = counter + 1;  // 只有 let mut 绑定能重新赋值
```

### shadowing

`let` 可以遮蔽（shadow）同名变量。新的 `let` 创建的是**全新的绑定**，
因此可以改变类型：

```rust
let spaces = "   ";          // &str（字节切片）
let spaces = spaces.len();   // usize，类型变了
```

这条规则在 zr 与 Rust 中一致，也是「零成本抽象」的关键：
遮蔽发生在编译期，运行时不产生任何拷贝。

### ⚠️ 关于 `var`

zr 的 README 里写过 `let` 表示不可变、`var` 表示可变。**这一点尚未实现**：
整个标准库（`std/*.zr`，136 处可变绑定）用的都是 `let mut`，`var` 一次都没出现，
且 `var` 声明的绑定在后续作用域里无法被解析到。

因此本教程统一使用 `let mut`。如果将来 `var` 落地，这批示例只需一次替换。

## 数据类型

zr 把类型分成两类：**标量**和**复合**。

### 标量类型

| 类别 | 类型 | 大小 | 取值范围 |
|:-----|:-----|:-----|:---------|
| 8 位有符号 | `i8` | 1 字节 | −128 ~ 127 |
| 16 位有符号 | `i16` | 2 字节 | −32768 ~ 32767 |
| 32 位有符号 | `i32` | 4 字节 | −2³¹ ~ 2³¹−1 |
| 64 位有符号 | `i64` | 8 字节 | −2⁶³ ~ 2⁶³−1 |
| 128 位有符号 | `i128` | 16 字节 | −2¹²⁷ ~ 2¹²⁷−1 |
| 平台相关有符号 | `isize` | 指针宽 | 同上，按平台 |
| 8 位无符号 | `u8` | 1 字节 | 0 ~ 255 |
| 16 位无符号 | `u16` | 2 字节 | 0 ~ 65535 |
| 32 位无符号 | `u32` | 4 字节 | 0 ~ 2³²−1 |
| 64 位无符号 | `u64` | 8 字节 | 0 ~ 2⁶⁴−1 |
| 128 位无符号 | `u128` | 16 字节 | 0 ~ 2¹²⁸−1 |
| 平台相关无符号 | `usize` | 指针宽 | 同上，按平台 |
| 浮点 | `f16` / `f32` / `f64` | 2 / 4 / 8 字节 | IEEE 754 |
| 布尔 | `bool` | 1 字节 | `true` / `false` |
| 字符 | `char` | 4 字节 | Unicode 标量值 |
| 指针 | `*const T` / `*mut T` | 指针宽 | 原始地址 |

`i32` 是默认整数类型，`f64` 是默认浮点类型。**类型之间不做隐式转换**：

```rust
let a: i32 = 5;
let b: i64 = a as i64;      // 必须写 as
```

`isize` / `usize` 在 32 位目标上大小减半 —— 但 32 位目标的多字长（`i64`）算术
目前按两次 32 位运算模拟，见[支持的目标平台](/tools/targets/)。

### 复合类型

#### 元组

```rust
fn divmod(a: i32, b: i32) -> (i32, i32) {
    return (a / b, a % b);
}

// 解构
let pair = divmod(17, 5);
let (q, r) = pair;

// 按索引访问
println_int(pair.0);
```

元组的长度在类型层面是已知的，因此编译器知道每个元素的类型与偏移。

#### 数组

```rust
let arr: [i32; 5] = [10, 20, 30, 40, 50];
println_int(arr[0]);
let n = arr.len;            // 长度是编译期常量，用 .len 读取，不带括号
```

数组长度写在类型里，因此栈上大小固定。

#### 切片

`[]const T`（不可变）与 `[]mut T`（可变）是一段内存的视图，只带指针和长度，
**传递切片不会拷贝数据**：

```rust
let arr: [i32; 5] = [10, 20, 30, 40, 50];
let s: []const i32 = arr;   // 整个数组变成切片
let first_two = s[0..2];    // 也可以取子区间
```

切片的完整用法见 [2. 所有权系统](/learn/02-ownership/)。

## 函数

```rust
/// 计算阶乘。
///
/// 文档注释用三个斜杠，会被 `zr doc` 收集（规划中）。
fn factorial(n: i64) -> i64 {
    if n <= 1 {
        return 1;
    }
    return n * factorial(n - 1);
}

fn main() -> i32 {
    println_int(factorial(5));
    return 0;
}
```

要点：

- 函数签名写成 `fn name(params) -> ReturnType`。
- 返回值写在 `->` 之后；没写就是无返回（单元类型）。
- zr 的风格是**显式 `return`**。末尾表达式不会隐式返回，这比 Rust 更啰嗦一点，
  但让「这个函数到底返回什么」永远不用往上看。

### 注释

```rust
// 行注释，到行尾结束

/*
   块注释，可以跨行
   词法分析器支持嵌套
*/

/// 文档注释，会附在下一个声明上。
pub fn documented() -> i32 { return 0; }
```

### 语句与表达式

zr 的表达式分两类：

- **表达式**产生值：`1 + 2`、`if` 的分支、函数调用。
- **语句**不产生值：赋值、`let` 声明、循环。

`if` 作为语句时，各分支类型必须一致（通常都返回单元）：

```rust
let mut total = 0;
if flag {
    total = 1;
}
```

## 控制流

### `if`

```rust
fn classify(code: i32) -> []const u8 {
    if code == 200 {
        return "OK";
    } else if code >= 500 {
        return "Server Error";
    } else if code >= 400 {
        return "Client Error";
    } else {
        return "Unknown";
    }
}
```

`if` 的条件必须是 `bool`，**不接受整数或指针的非零判断**。编译器会强制这一点，
因为「把指针当条件」正是 C 里最常见的一类 bug。

### 分支早返回

zr 目前推荐用早返回组织多分支，而不是嵌套 `if`：

```rust
fn parse_head(bytes: []const u8) -> Option<usize> {
    if bytes.len < 4 {
        return Option::None;
    }
    // 只有到这里才继续往下走
    return Option::Some(read_len(bytes));
}
```

这与「扁平化控制流」的哲学一致：守卫条件提前退出，剩下的路径就是主线。

### `loop`

无限循环，靠 `break` 退出；`loop` 可以带值：

```rust
loop {
    let n = next();
    if n == 0 { break; }
    if n < 0 { continue; }
}

let result = loop {
    if ready() { break compute(); }   // 退出时带一个值
    yield_now();
};
```

### `while`

```rust
let mut i = 0;
while i < 100 {
    if i % 15 == 0 { println("FizzBuzz"); }
    i += 1;
}
```

这是当前标准库里最常用的循环形态 —— 因为 `for..in` 尚未可用（见下方说明）。

### `for`

```rust
for x in arr {
    println_int(x);
}

for i in 0..10 {      // 0..10 含 0 不含 10
    println_int(i);
}

for i in 0..=10 {     // 含尾
    println_int(i);
}
```

`for` 的底层是迭代器协议，见 [9. 函数式编程特性](/learn/09-functional/)。

> **⚠️ 唯一的缺口**：`while`、`loop` / `break` / `continue`、`if` 作为表达式
> 在 v0.6.0 起全部可用（用例 `09_while` / `15_loops` / `17_loop_break` /
> `10_if_expression` / `11_if_else_chain`）。但 **`for` 仍然不可用** ——
> `for x in a..b` 里的 `..` 区间表达式仍然解析成标识符。

## 小结

| 概念 | zr 写法 | 与 Rust 的差异 |
|:-----|:--------|:---------------|
| 不可变绑定 | `let x = 1;` | 一致 |
| 可变绑定 | `let mut x = 1;` | 一致（README 写的 `var` 尚未实现） |
| shadowing | `let x = ...; let x = ...;` | 一致 |
| 隐式转换 | 无，必须 `as` | 一致 |
| 返回 | 显式 `return` | zr 不做尾表达式隐式返回 |
| 条件类型 | 必须是 `bool` | 一致 |

下一章：[2. 所有权系统](/learn/02-ownership/) —— zr 内存安全模型的核心。