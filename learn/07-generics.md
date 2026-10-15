---
title: 7. 泛型、Trait 与生命周期
description: 泛型函数与类型、trait 与默认实现、trait bound、关联类型、生命周期标注与省略规则。
sidebar: learn
status: planned
status_note: 类型检查器尚未把类型参数绑定成类型。
prev:
  title: 6. 错误处理
  url: /learn/06-errors/
next:
  title: 8. 自动化测试
  url: /learn/08-testing/
---

泛型让你写一次、对多种类型生效的代码；trait 描述「一个类型能做哪些事」；
生命周期描述「引用能活多久」。三者共同构成了 zr 的零成本抽象能力。

> **⚠️ 当前状态**：类型检查器尚未把类型参数绑定成类型。本章是设计说明。

## 泛型函数

```rust
fn largest<T: Ord>(slice: []const T) -> T {
    let mut m = slice[0];
    let mut i = 1;
    while i < slice.len {
        let item = slice.ptr[i];
        if item > m { m = item; }
        i += 1;
    }
    return m;
}
```

`<T: Ord>` 是 trait 约束（bound）：告诉编译器「`T` 必须能比较大小」。
没有它，`>` 无从判断 —— 编译器不可能为任意类型生成比较指令。

约束也可以写在 `where` 子句里，适合多行或多个约束：

```rust
fn process<T>(value: T) -> T
where T: Clone + Default
{
    return value;
}
```

两种写法等价，选择依据是可读性：短的用行内，长的用 `where`。

## 泛型类型

```rust
struct Pair<T> {
    a: T,
    b: T,
}

enum Option<T> {
    Some(T),
    None,
}

enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

`Option<T>` 和 `Result<T, E>` 都是标准库里的泛型类型。

### `impl` 块里的泛型

```rust
impl<T> Pair<T> {
    fn first(self) -> T {
        return self.a;
    }
}
```

`impl<T>` 表示这个块对所有 `T` 成立；`impl Pair<i32>` 则只针对 `i32`。

### 方法级泛型

```rust
impl<T> Vec<T> {
    /// 只在 `T` 是 `Vec<U>` 时才提供这个方法
    fn flatten<U>(self) -> Vec<U> { return Vec::new(); }
}
```

## Trait

Trait 定义「某个类型能做哪些事」：

```rust
use core::{Eq, Ord, Copy, Clone, Display, Debug, Default, Hash, Iterator, ToString};
```

标准库内置的核心 trait：

| trait | 语义 |
|:------|:-----|
| `Eq` | 相等比较 |
| `Ord` | 全序比较（`Eq` 的子 trait） |
| `Copy` | 按位复制即可，赋值不触发所有权移动 |
| `Clone` | 可显式深拷贝 |
| `Default` | 有默认值（`0`、`""`、空容器） |
| `Display` | 面向用户的格式化 |
| `Debug` | 面向开发者的格式化（`Display` 的子 trait） |
| `Hash` | 可作为哈希键 |
| `ToString` | 可转成字符串 |
| `Iterator` | 提供 `next`，是 `for` 与适配器的基础 |

`Ord` 声明为 `: Eq` 表示**超 trait**（supertrait）：实现 `Ord` 必须先实现 `Eq`。

```rust
pub trait Summary {
    fn summarize(self) -> String;

    // 默认实现：不写就不会被要求实现
    fn headline(self) -> String {
        return String::from_bytes("摘要");
    }
}
```

### 实现一个 trait

```rust
impl Summary for Pair<u8> {
    fn summarize(self) -> String {
        let mut s = String::from_bytes("pair(");
        s.push_uint(self.a as u64);
        s.push_str(&String::from_bytes(", "));
        s.push_uint(self.b as u64);
        s.push_str(&String::from_bytes(")"));
        return s;
    }
}
```

### 关联类型

trait 可以声明「这个类型内部还挂着另一个类型」：

```rust
pub trait Iterator {
    type Item;
    fn next(self: &mut Self) -> Option<Self::Item>;
}
```

`Self::Item` 是**关联类型**。和泛型参数的区别是：泛型由调用方指定（一个类型参数
可以有多种选择），关联类型由实现方指定（每个实现只有一种）。

### 标准库里一个完整例子

```rust
pub trait Mappable {
    type Item;
    type Output;

    fn map<F>(self, f: F) -> Self::Output
    where F: Fn(Self::Item) -> Self::Output;
}

impl<T, U> Mappable for Vec<T> {
    type Item = T;
    type Output = Vec<U>;

    fn map<F>(self, f: F) -> Vec<U>
    where F: Fn(T) -> U
    {
        let mut out = Vec::with_capacity(self.len());
        let mut i = 0;
        while i < self.len {
            out.push(f(self.ptr[i]));
            i += 1;
        }
        return out;
    }
}
```

## Trait bound

### 参数位置

```rust
fn print_all<T: Display>(items: &[]const T) { /* ... */ }
```

### 返回位置

```rust
fn make_iter<T: Iterator>() -> T::Item { /* ... */ }
```

### 实现位置

```rust
fn summarize_all<T: Summary>(items: &Vec<T>) { /* ... */ }
```

### 用 bound 做条件编译

```rust
fn print_debug<T>(v: T) {
    // 只有 T: Debug 时这段才成立
    v.debug_fmt();
}
```

## `#[derive]`：自动实现

zr 的 `#[derive]` 不是一个宏展开器，而是一个**快捷声明**：

```rust
#[derive(Debug, Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}
```

编译器把 `derive` 里列出的 trait 视为该类型已实现（`src/typeck/infer.rs`
在解析 trait 约束时检查这个属性）。它让代码读起来像是自动派生的，
实际语义是「声明这些 trait 对这个类型成立」。

> 与 Rust 的差别：Rust 的 `derive` 会真正生成 impl 代码；zr 的实现是一个
> 类型检查层的捷径，不生成代码。

## 静态分发 vs 动态分发

**泛型 = 静态分发（单态化）**。编译器为每个具体类型生成一份代码，
调用点没有间接开销：

```rust
fn print_all<T: Display>(items: &[]const T) {
    for item in items {
        item.display(STDOUT_FD);
    }
}
```

**`dyn Trait` = 动态分发**。一次虚调用换取灵活性，适合异构集合：

```rust
fn log_any(writer: &dyn Write, msg: &str) {
    writer.write(msg);
}
```

标准库里的 `Waker` 就是 trait 对象：`Waker::new(w: *mut dyn Wake)`。
选择标准很简单：类型集合编译期已知就用静态，否则用动态。

## 生命周期

### 函数签名

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { return x; }
    return y;
}
```

`'a` 的含义是：返回值借用自两个输入，且不会活得比任一输入更久。

### 结构体

```rust
struct Ref<'a, T> {
    value: &'a T,
}
```

`Ref` 实例不会活得比它内部的 `&'a T` 更久。

### 实现里

```rust
impl<'a> Context<'a> {
    pub fn new(waker: &'a Waker) -> Context<'a> { /* ... */ }
    pub fn waker(self: &'a Context<'a>) -> &'a Waker { /* ... */ }
}
```

### 三条省略规则

绝大多数签名不需要手写生命周期：

1. **每个引用参数得到一个独立的生命周期参数。**
2. **只有一个输入生命周期时**，它被赋给所有输出生命周期（方法里的 `self` 除外）。
3. **有 `self` 时**，`self` 的生命周期被赋给所有输出生命周期。

```rust
fn first_word(s: &str) -> &str         // 等价于 first_word<'a>(s: &'a str) -> &'a str
fn annotate(s: &str, t: &str) -> &str  // 两个独立参数
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str   // 显式指定：返回值借用两者
```

### 生命周期与泛型的区别

| | 泛型 `T` | 生命周期 `'a` |
|:--|:----------|:--------------|
| 描述 | 类型 | 存活时间 |
| 写在哪 | 尖括号 `<T>` | 单引号 `'a` |
| 运行时 | 单态化，零成本 | 零成本（只是约束） |

## 编译器怎么解约束

zr 的类型检查器按这七步走（详见[编译器架构](/tools/architecture/)）：

```
名称解析 → HIR 构建 → 类型推断 → trait 求解 → 借用检查 → 穷尽性检查 → 闭包分析
```

「trait 求解」这一步要回答的问题是：面对 `T: Ord`，哪个 `impl` 适用？
zr 的实现是按候选匹配 + 一致性检查（coherence）：

- 两个 `impl` 不能为同一个类型实现同一个 trait（孤儿规则）；
- `Send`、`Sync`、`Unpin`、`Sized` 被特判为**内建 auto trait**，
  自动对所有满足条件的类型成立，不需要手写 `impl`；
- `#[marker]` 标记的 trait（如 `Send`）没有方法，只有「这个类型满足吗」这个问题。

对应的设计文档在仓库的 `future/trait_system/`：
关联类型投影、HRTB（`for<'a>`）、特化、孤立规则、`impl Trait`、负 trait bound。

## 小结

| 概念 | zr 写法 |
|:-----|:---------|
| 泛型函数 | `fn f<T>(x: T) -> T` |
| 泛型类型 | `struct S<T> { v: T }` |
| 约束 | `<T: Ord>` 或 `where T: Ord` |
| trait 定义 | `trait Name { fn m(self) -> R; }` |
| 默认实现 | trait 里直接写函数体 |
| 实现 trait | `impl Name for Type { ... }` |
| 关联类型 | `type Item;` + `Self::Item` |
| 自动派生 | `#[derive(Debug, Clone)]` |
| 动态分发 | `&dyn Trait` |
| 生命周期 | `fn f<'a>(x: &'a T) -> &'a T` |

下一章：[8. 自动化测试](/learn/08-testing/)。