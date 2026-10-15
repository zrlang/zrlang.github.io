---
title: 类型与 trait
description: zr 的 Hindley-Milner 类型推导、trait 约束求解、关联类型与静态 / 动态分发。
sidebar: learn
prev:
  title: 所有权与借用
  url: /learn/ownership/
next:
  title: 错误处理
  url: /learn/errors/
---

zr 的类型系统是 **Hindley-Milner 的一个子集**，加上 trait 约束与关联类型。
类型推导发生在编译期，运行时不携带任何类型信息。

## 类型推导

大多数情况下你不需要写类型标注：

```rust
let x = 42;                    // i32
let y = 3.14;                  // f64
let z = x + 1;                 // i32
let flag = true;               // bool

let v = Vec::new();            // 元素类型由后续 push 推导
v.push(1);                     // 此时 v: Vec<i32>
```

标注只在推导不出来（或你想固定某个具体类型）时才需要：

```rust
let zero: f64 = 0.0;
let empty: []const u8 = "abc" as []const u8;
```

## trait：行为的契约

trait 定义「某个类型能做哪些事」，泛型通过约束使用它：

```rust
pub trait Mappable {
    type Item;                   // 关联类型
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
        while i < self.len() {
            out.push(f(self[i]));
            i += 1;
        }
        return out;
    }
}
```

`where` 子句适合多行约束，行内的 `T: A + B` 适合简短的：

```rust
fn largest<T: Ord + Copy>(slice: []const T) -> T { /* ... */ }

fn process<T>(value: T) -> T
where T: Clone + Default
{
    return value;
}
```

## 静态分发与动态分发

**泛型 = 静态分发（单态化）**。编译器为每个具体类型生成一份代码，调用点没有任何间接开销：

```rust
fn print_all<T: Display>(items: &[T]) {
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

选择标准很简单：类型集合是编译期已知的就静态，否则动态。

## 内置核心 trait

| trait | 语义 |
|:------|:-----|
| `Copy` | 按位复制即可，赋值不触发所有权移动 |
| `Clone` | 可显式深拷贝 |
| `Eq` / `Ord` | 相等与全序比较 |
| `Default` | 有默认值（`0`、`""`、空容器） |
| `Display` / `Debug` | 面向用户 / 面向开发者的格式化 |
| `Iterator` | 提供 `next`，是 `for` 循环的基础 |
| `Fn` / `FnMut` / `FnOnce` | 可调用对象的三种闭包能力 |

## 关联类型与迭代器

```rust
pub trait Iterator {
    type Item;
    fn next(self: &mut Self) -> Option<Self::Item>;
}
```

`for i in 0..10` 会被脱糖成对 `Iterator::next` 的反复调用 —— 零成本。

```rust
fn sum_even(n: i32) -> i32 {
    let mut total = 0;
    for i in 0..n {
        if i % 2 == 0 { total += i; }
    }
    return total;
}
```

## 代数数据类型

枚举 + 载荷构成 tagged union，是 zr 表达递归数据结构的方式：

```rust
pub enum List<T> {
    Nil,
    Cons(T, Box<List<T>>),
}

impl<T> List<T> {
    pub fn push(self, value: T) -> List<T> {
        return List::Cons(value, Box::new(self));
    }

    pub fn length(self) -> usize {
        return match self {
            List::Nil => 0,
            List::Cons(_, tail) => 1 + tail.length(),
        };
    }
}
```

### 穷尽性检查

`match` 必须覆盖所有情况，否则是编译错误：

```rust
match state {
    State::Idle    => run(),
    State::Running => wait(),
    State::Done    => finish(),
    // 缺少分支：编译错误 —— State 有三个变体
}
```

这消灭了一整类「忘了处理某个分支」的运行时 bug。

## 布局与 ABI

当数据要跨越 FFI 或写进文件时，显式声明布局：

```rust
#[repr(C)]          // C 兼容布局：字段按声明顺序紧密排列
pub struct Packet {
    magic:  u32,
    length: u32,
}

#[repr(u8)]         // 枚举的判别值占 1 字节
pub enum Status {
    Pending = 0,
    Running = 1,
    Done    = 2,
}

#[repr(C, packed)]  // 取消尾部填充，用于精确的二进制协议
struct Header { /* ... */ }
```

## 类型系统的边界

zr **没有**以下特性：

- 没有 `dyn Trait` 之外的多态继承（没有类继承，没有方法重写）。
- 没有隐式类型转换（`i32` 到 `i64` 必须显式 `as`）。
- 没有运算符重载的通用机制（内置运算符与语言核心绑定）。
- 递归类型需要显式的 `Box<T>` 来打断无限大小推导。

这不是遗漏，而是刻意的：**显式优于隐式**。每个语言特性都要能回答「它在编译期做了什么」。

## 下一步

- `Result` 与 `?` → [错误处理](/learn/errors/)
- 编译器如何求解 trait 约束 → [编译器架构](/tools/architecture/)