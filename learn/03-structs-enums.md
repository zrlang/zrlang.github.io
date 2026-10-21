---
title: 3. 结构体与枚举
description: 定义与实例化结构体、impl 方法语法、枚举与 Option——组织数据的两种基本形态。
sidebar: learn
status: ready
status_note: >-
  struct 构造、字段读写、嵌套、按值传参/返回、作用域析构、impl 方法均已实现；
  enum 与 Option 已支持；trait 对象动态分派仍属于后续目标。
prev:
  title: 2. 所有权系统
  url: /learn/02-ownership/
next:
  title: 4. 包管理与项目
  url: /learn/04-project/
---

结构体把相关字段组合成一个有名字的类型，枚举表达「一个值是若干可能之一」。
zr 的这两者与 Rust 同构，额外提供了显式的布局控制。

> **⚠️ 当前状态**：`struct` 构造、字段读写、impl 方法均已实现；
> `enum` 与 `Option` 已支持；trait 对象动态分派仍属于后续目标。
> 本章是设计说明。

## 定义与实例化

```rust
struct User {
    name:    String,
    email:   String,
    age:     u8,
    active:  bool,
}

fn build(name: &str, age: u8) -> User {
    return User {
        name:   String::from_bytes(name),
        email:  String::from_bytes("nobody@example.com"),
        age:    age,
        active: true,
    };
}

fn main() -> i32 {
    let u = build("zr", 0);
    println(u.name.as_bytes());   // 字段访问用点号
    println_bool(u.active);
    return 0;
}
```

### 简写

字段名与变量名相同时可以省略：

```rust
let name = String::from_bytes("zr");
let age = 25;
let u = User { name: name, age: age, email: e, active: true };
```

### 不可变与可变

结构体本身不区分可变性，可变性来自绑定：

```rust
let u = build("zr", 0);      // 整个用户不可变
let mut u = build("zr", 0);  // 之后可以整体替换 u
```

zr 没有 `mut` 字段语法（`mut` 只用于绑定与函数参数）：

```rust
// ❌ 不存在这种写法
// struct User { mut name: String }
```

### 元组结构体

```rust
struct Meters(f64);
struct Point(f64, f64);

fn dist(p: Point) -> f64 {
    let x = p.0;
    let y = p.1;
    return (x * x + y * y).sqrt();
}
```

元组结构体适合「新类型」语义 —— 给 `f64` 起名叫 `Meters`，就禁止了把米和英尺混着加。

### 结构体更新语法

```rust
let bigger = Rectangle { width: 100, ..smaller };
```

用已有结构的其余字段补全，只需要列出要改的字段。

## 方法语法

`impl` 块为类型附加函数。

```rust
struct Rectangle {
    width:  f64,
    height: f64,
}

impl Rectangle {
    // 关联函数（无 self）：常用于构造器
    pub fn new(width: f64, height: f64) -> Rectangle {
        return Rectangle { width: width, height: height };
    }

    // 接收所有权
    pub fn area(self) -> f64 {
        return self.width * self.height;
    }

    // 可变引用：避免昂贵拷贝
    pub fn scale(self: &mut Rectangle, factor: f64) {
        self.width  *= factor;
        self.height *= factor;
    }
}
```

`self` 的写法决定了方法的「代价」，这是 zr 最重要的性能约定：

| 写法 | 语义 | 什么时候用 |
|:-----|:-----|:-----------|
| `self` | 取得所有权 | 需要消费掉这个值（见第 2 章的 `consume`） |
| `self: &T` | 不可变借用 | 只读的常见情形，默认选它 |
| `self: &mut T` | 可变借用 | 要改字段，且调用后还要继续用 |

```rust
let mut r = Rectangle::new(2.0, 3.0);
let a = r.area();     // 借用，r 仍然可用
r.scale(2.0);         // 可变借用
println_int(r.area() as i64);
```

### 关联函数

没有 `self` 的 `impl` 函数通过类型名调用：

```rust
let r = Rectangle::new(2.0, 3.0);
let c = Rectangle::unit();     // 关联函数，不是方法
```

### 默认实现

`impl` 里可以定义默认行为，详见 [7. 泛型、Trait 与生命周期](/learn/07-generics/)。

## 枚举

枚举定义「一个值属于若干变体之一」，每个变体可以携带不同的数据。

```rust
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(u8, u8, u8),
}
```

变体携带的数据量各不相同 —— 这正是 Rust/Zig 系枚举相对「tag + union」手写结构体的优势：
布局由编译器根据实际用到的变体计算，通常带一个判别标签加一个最大载荷。

### 方法

枚举也可以有 `impl`：

```rust
impl Message {
    pub fn is_quit(self) -> bool {
        return match self {
            Message::Quit => true,
            _            => false,
        };
    }
}
```

### 内存布局

```rust
#[repr(u8)]
pub enum Status {
    Pending = 0,
    Running = 1,
    Done    = 2,
}
```

`#[repr(u8)]` 让判别值占一个字节并采用指定取值。zr 的属性系统实现了
`repr(C)` / `repr(packed)` / `repr(transparent)` / `repr(simd)` —— 它们是
真正参与布局计算的，不是装饰。

## `Option`

`Option<T>` 定义在标准库里，表示「可能有一个 `T`，也可能没有」：

```rust
pub enum Option<T> {
    Some(T),
    None,
}
```

因为它是枚举，[2. 所有权系统](/learn/02-ownership/) 里的穷尽性检查同样适用 ——
编译器会强制你处理 `None` 分支，这消灭了「忘了处理空指针」这一整类 bug。

标准库提供的操作（`std/core.zr`）：

```rust
let some = Option::Some(42);

assert(some.is_some(), "is_some");
assert(!some.is_none(), "is_none");
assert_eq(some.unwrap(), 42, "unwrap");

let none: Option<i32> = Option::None;
assert(none.is_none(), "is_none");
assert_eq(none.unwrap_or(99), 99, "unwrap_or");

// 变换
let doubled = some.map(|x: i32| -> i32 { return x * 2; });
assert_eq(doubled.unwrap(), 84, "map");
```

常用方法：

| 方法 | 作用 |
|:-----|:-----|
| `is_some()` / `is_none()` | 判断 |
| `unwrap()` | 取值，失败则 panic |
| `unwrap_or(v)` | 取值，失败用 `v` |
| `map(f)` | 成功时对值施加 `f` |
| `map_err(f)` | 失败时对错误施加 `f` |

### 在函数签名里返回 `Option`

zr 的惯例是「可能失败就返回 `Option`/`Result`」，而不是 panic：

```rust
fn find_byte(bytes: []const u8, target: u8) -> Option<usize> {
    let mut i = 0;
    while i < bytes.len {
        if bytes[i] == target { return Option::Some(i); }
        i += 1;
    }
    return Option::None;
}
```

### 用 `?` 提前返回

返回 `Option` 的函数可以用 `?`：

```rust
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    let pos = find_byte(bytes, b' ')?;    // 没找到就返回 None
    return &s[0..pos];
}
```

## 内存布局小结

| 类型 | 大小 |
|:-----|:-----|
| `struct User` | 各字段大小之和 + 对齐填充 |
| `struct Point(f64, f64)` | 同上 |
| `#[repr(C)] struct` | 同上，但按声明顺序紧密排列，供 C 使用 |
| `#[repr(packed)] struct` | 去掉全部填充，用于精确二进制协议 |
| `enum` | 判别标签 + 最大变体载荷 |

所有布局在编译期确定，没有任何运行时元信息。

## 小结

| 概念 | zr 写法 |
|:-----|:---------|
| 定义结构体 | `struct Name { field: Type }` |
| 实例化 | `Name { field: value }` |
| 更新语法 | `Name { a: 1, ..old }` |
| 方法 | `impl Name { fn m(self: &T) {} }` |
| 关联函数 | `impl Name { pub fn new() -> Name {} }` |
| 可变方法 | `self: &mut T` |
| 枚举 | `enum Name { A, B(T) }` |
| 布局控制 | `#[repr(C)]` `#[repr(packed)]` `#[repr(u8)]` |
| 可选值 | `Option<T>` = `Some(T)` / `None` |

下一章：[4. 包管理与项目](/learn/04-project/) —— zr 的编译模型与模块系统。