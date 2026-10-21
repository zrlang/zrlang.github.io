---
title: 12. 面向对象特性
description: zr 没有类。封装、trait 对象、以及用状态模式建模。
sidebar: learn
status: partial
status_note: 结构体、impl 方法已实现；trait 对象动态分派仍属于后续目标。
prev:
  title: 11. 并发编程
  url: /learn/11-concurrency/
next:
  title: 13. 模式匹配
  url: /learn/13-patterns/
---

Rust 说「没有面向对象，但有 trait」。zr 的立场更彻底：**连 trait 对象都用得很少**。
这一章讲清楚 zr 怎么表达「对象」，以及什么时候不该用面向对象。

> **⚠️ 当前状态**：结构体与 `impl` 方法均已实现；
> trait 对象动态分派仍属于后续目标。

## zr 里没有类

zr 没有 `class`，没有继承，没有方法重写，没有 `Self` 继承链。

| 概念 | C++ / Java | Rust | zr |
|:-----|:-----------|:-----|:----|
| 数据 + 行为打包 | class | struct + impl | struct + impl |
| 行为契约 | 抽象基类 / 接口 | trait | trait |
| 多态 | 虚函数表 | trait 对象 | `dyn Trait` |
| 继承 | ✘ | ✘ | ✘ |

zr 用两个正交的东西替代继承：

- **数据用结构体**（见 [3. 结构体与枚举](/learn/03-structs-enums/)）
- **行为用 trait**（见 [7. 泛型、Trait 与生命周期](/learn/07-generics/)）

组合永远优先于继承：需要「有一个」时，放一个字段，而不是继承一个父类。

## 封装

封装在 zr 里是**可见性**的事，不需要 `private` 关键字 —— 默认就是私有的。

```rust
pub struct Logger {
    // 字段不写 pub，就是私有的
    prefix:  String,
    enabled: bool,
}

impl Logger {
    // 外部只能通过这个构造
    pub fn new(prefix: &str) -> Logger {
        return Logger {
            prefix:  String::from_bytes(prefix),
            enabled: true,
        };
    }

    // 外部只能通过这两个方法操作内部状态
    pub fn log(self: &Logger, msg: &str) {
        if !self.enabled { return; }
        println(self.prefix.as_bytes());
        println(msg);
    }
}

pub fn set_enabled(self: &mut Logger, v: bool) {
    self.enabled = v;
}
```

三个可见性级别：

| 写法 | 含义 |
|:-----|:-----|
| 无修饰符 | 私有（默认），当前模块可见 |
| `pub` | 公开，外部可见 |
| `pub(crate)` | 仅当前 crate 可见 |
| `pub(super)` | 仅父模块可见 |

zr 没有 `pub(in path)` 形式的限定路径可见性。

## Trait 对象：动态分发

泛型是静态分发，`dyn Trait` 是动态分发：

```rust
pub trait Write {
    fn write_str(self: &mut Self, s: &str);
    fn flush(self: &mut Self);
}

pub struct File;
pub struct BufWriter;

impl Write for File { /* ... */ }
impl Write for BufWriter { /* ... */ }

// 动态分发：运行时按虚表调用
fn log_any(writer: &mut dyn Write, msg: &str) {
    writer.write_str(msg);
    writer.flush();
}

// 静态分发：两个独立实例化，零开销
fn log_static(writer: &mut File, msg: &str) {
    writer.write_str(msg);
    writer.flush();
}
```

标准库里的 `Waker` 就是 trait 对象：`Waker::new(w: *mut dyn Wake)`。

### 什么时候用哪个

| | 泛型 `<T: Write>` | `dyn Write` |
|:--|:------------------|:------------|
| 分发方式 | 单态化，静态调用 | 虚表，间接调用 |
| 代码体积 | 每个类型一份 | 一份 |
| 运行时开销 | 零 | 一次间接跳转 |
| 异构集合 | ✘ | ✔ |
| 二进制大小敏感 | 可能膨胀 | 可控 |

判断标准：**类型集合在编译期已知就用泛型，否则用 `dyn`。**

## 状态模式

Rust 教程用状态模式举例是因为 Rust 没有类继承，而状态机天然适合用枚举表达。
zr 的做法一样，而且更直接 —— 用 `enum` + `match`。

```rust
pub enum State {
    Draft,
    PendingReview,
    Published,
    Rejected(String),
}

impl State {
    // 每个状态能做的事不同
    pub fn can_publish(self) -> bool {
        return match self {
            State::Published => false,
            _               => true,
        };
    }

    pub fn label(self) -> String {
        return match self {
            State::Draft           => String::from_bytes("草稿"),
            State::PendingReview   => String::from_bytes("待审"),
            State::Published       => String::from_bytes("已发布"),
            State::Rejected(reason) => reason,
        };
    }
}
```

调用方不需要知道有四种状态，只需要知道「当前状态允许什么」：

```rust
pub enum Message {
    Submit,
    Approve,
    Reject(String),
}

pub fn handle(msg: Message, state: &mut State) {
    *state = match msg {
        Message::Submit  => State::PendingReview,
        Message::Approve => State::Published,
        Message::Reject(r) => State::Rejected(r),
    };
}
```

`match` 的**穷尽性检查**在这里是核心价值：加了新状态却忘了处理，
编译器会直接报错。继承体系做不到这一点。

## 用 trait 表达「能力」而不是「种类」

zr 的风格是按能力切 trait，而不是按继承树分层次：

```rust
pub trait Readable { fn read(self) -> String; }
pub trait Writable { fn write(self: &mut Self, s: &str); }
pub trait ReadWrite: Readable + Writable { }
```

一个类型可以只实现 `Readable`，实现两个就自动获得 `ReadWrite`。
这比「继承自一个基类」灵活得多：组合能力，而不是选择祖先。

## 不该用面向对象的时候

zr 的几条经验规则：

1. **没有多态需求就别引入 trait** —— 一个 `match` 或一个 `enum` 往往更清楚。
2. **优先按值传递** —— `T` 的所有权移动通常比 `&T` 更便宜（尤其是大结构体）。
3. **优先借用** —— 只有在确实要消费掉这个值时才用 `self` 而非 `self: &T`。
4. **状态用枚举，行为用 trait** —— 这是本章最核心的一句话。

## 与 Rust 的差异

| | Rust | zr |
|:--|:-----|:----|
| 类的替代 | struct + impl | struct + impl（一致） |
| 行为契约 | trait | trait（一致） |
| 动态分发 | `dyn Trait` | `dyn Trait`（一致） |
| 闭包作为「轻量对象」 | 常用 | 闭包未实现，函数指针替代 |
| `impl Trait` / RPIT | 支持 | 设计文档已写（`future/trait_system/impl_trait.md`） |
| 负 trait bound | 不支持 | 设计文档已写（`negative_bounds.md`） |

## 小结

| 概念 | zr 写法 |
|:-----|:---------|
| 数据 | `struct`（字段默认私有） |
| 行为 | `impl` 块 |
| 抽象契约 | `trait` |
| 动态分发 | `&dyn Trait` / `*mut dyn Trait` |
| 状态建模 | `enum` + `match`（靠穷尽性检查） |
| 能力组合 | `trait A: B + C` |
| 继承 | 没有 |

下一章：[13. 模式匹配](/learn/13-patterns/) —— `match` 的完整形态。