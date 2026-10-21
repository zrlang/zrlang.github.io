---
title: 2. 所有权系统
description: 所有权规则、引用与借用、切片——zr 在编译期证明内存安全的核心机制。
sidebar: learn
status: ready
status_note: 所有权规则、引用与借用、生命周期、Drop trait 均已实现； struct 与 impl 方法可用；唯一缺口是 trait 对象动态分派仍属于后续目标。
prev:
  title: 1. 基础语法
  url: /learn/01-syntax/
next:
  title: 3. 结构体与枚举
  url: /learn/03-structs-enums/
---

所有权是 zr 与 Rust 共享的设计：用一个静态规则集取代垃圾回收器，
在编译期证明内存安全，运行时开销为零。

> **⚠️ 当前状态**：借用检查器、引用与生命周期均已实现（v0.6.0）。
> 本章描述的是设计目标，不是当前可用功能。

## 为什么需要所有权

内存管理历史上只有两条路：

- **手动管理**（C / C++）—— 自由，但 use-after-free、double-free 是日常。
- **垃圾回收**（Go / Python / Java）—— 安全，但暂停、吞吐损失、无法用于内核与嵌入式。

zr 走第三条：**编译期回收**。每个值在任一时刻有且只有一个所有者，
所有者离开作用域时编译器插入释放代码。运行时多出来的只是几条指令，
不需要 GC 的任何协作（标记位、屏障、停顿）。

## 所有权规则

1. **每个值有且仅有一个所有者。**
2. **当所有者离开作用域，值被自动释放。**
3. **赋值、传参或返回会转移所有权**，除非该类型实现了 `Copy`。

```rust
let s1 = String::from_bytes("hello");
let s2 = s1;              // 所有权从 s1 移动到 s2
// println(s1);           // ❌ 编译错误：s1 已经失效

let s3 = s2.clone();      // 想要副本就显式克隆
println(s2);
println(s3);
```

注意 `String` 在 zr 里是可增长的堆分配类型（见 [5. 集合类型](/learn/05-collections/)），
移动它意味着把那块堆内存的释放责任一起交出去。

### 函数签名如何表达所有权

```rust
fn consume(s: String) -> usize {
    return s.len();       // s 在这里被销毁
}

let owned = String::from_bytes("zr");
let len = consume(owned);
// println(owned);        // ❌ owned 已被移动
```

读一个函数签名时，**所有权流向**和所有权一同移动：

| 签名 | 含义 |
|:-----|:-----|
| `fn f(s: String)` | 拿走所有权，函数结束时销毁 |
| `fn f(s: &String)` | 借用，函数结束时还回来 |
| `fn f(s: &mut String)` | 可变借用，独占期间不能有其他引用 |

## `Copy` 与 `Clone`

```rust
let a = 42;              // i32 是 Copy
let b = a;               // ✅ 按位复制，a 仍然可用
```

`Copy` 让按位复制就够了，赋值不触发移动。标量类型（整数、浮点、`bool`、`char`、
指针、函数指针）都实现了 `Copy`。

`Clone` 是显式深拷贝：

```rust
let a = String::from_bytes("zr");
let b = a.clone();       // ✅ 深拷贝，a 与 b 都可用
```

`Clone` 的语义是「用户手动触发的一次复制」，代价由实现决定 —— 对 `Vec<T>`
就是一次堆分配加 `len` 次元素拷贝。

## 引用与借用

当你想「用一下但不要拿走」时，传入引用。

```rust
fn length(s: &String) -> usize {
    return s.len();
}

fn append(s: &mut String, c: u8) {
    s.push_byte(c);
}

let mut s = String::from_bytes("zr");
let n = length(&s);          // 不可变借用
append(&mut s, b'!');        // 可变借用
```

借用规则只有一条，但非常严格：

> **任意时刻，要么有任意多个不可变引用，要么恰好有一个可变引用。**

```rust
let mut data = Vec::new();

let r1 = &data;        // ✅ 多个不可变借用
let r2 = &data;        // ✅
let r3 = &mut data;    // ❌ 编译错误：data 已被不可变借用
```

这条规则同时消灭了两类 bug：

- **悬垂引用** —— 引用比数据活得久。不允许有第二个所有者，引用就没有主人可依附。
- **数据竞争** —— 两个写入者同时改同一块内存。独占可变借用在编译期排除它。

### 借用什么时候结束：NLL

zr 使用 **NLL（非词法生命周期）**：引用的存活期是它在程序里的**实际使用区间**，
而不是到作用域结尾。

```rust
let mut v = Vec::new();
v.push(1);

let first = &v[0];     // 不可变借用开始
println(first);        // 到这里结束

v.push(2);             // ✅ 合法：不可变借用不再被使用
```

这意味着借用检查器几乎不产生误报 —— 它拒绝的冲突都是真的。

## 生命周期

当编译器无法从字面推断引用的存活范围时，用标注告诉它：

```rust
// 返回值借用自两个输入
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { return x; }
    return y;
}
```

结构体也可以持有引用：

```rust
struct Ref<'a, T> {
    value: &'a T,
}
```

`'a` 的含义是：`Ref` 的实例不会活得比它内部的 `&'a T` 更久。

### 三条省略规则

大多数时候不需要手写生命周期，因为有三条规则：

1. **每个引用参数都会得到一个独立的生命周期参数。**
2. **只有一个输入生命周期时，它被赋给所有输出生命周期**（方法里的 `self` 除外）。
3. **有 `self` 时，`self` 的生命周期被赋给所有输出生命周期。**

因此 `fn first_word(s: &str) -> &str` 实际就是 `fn first_word<'a>(s: &'a str) -> &'a str`。

### 悬垂引用会被拒绝

```rust
fn dangling() -> &str {
    let local = String::from_bytes("oops");
    return &local;      // ❌ 编译错误：local 在函数结束时被销毁
}
```

生命周期检查保证返回的引用永远指向还活着的内存 —— 这正是零成本抽象能成立的前提：
你不需要在运行时保存任何额外信息。

## 切片

切片是「一段连续内存 + 长度」的视图，传递它不拷贝数据：

```rust
fn sum(values: []const i32) -> i32 {
    let mut total = 0;
    let mut i = 0;
    while i < values.len {
        total += values.ptr[i];
        i += 1;
    }
    return total;
}

let arr: [i32; 4] = [1, 2, 3, 4];
let s: []const i32 = arr;
println_int(sum(s));
```

### 字符串切片

`&str` 本身就是一个 `[]const u8` 的切片：

```rust
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    match bytes.find_byte(b' ') {
        Option::Some(pos) => &s[0..pos],
        Option::None       => s,
    }
}
```

### 内存布局

| 类型 | 布局 |
|:-----|:-----|
| `T` | 大小和对齐由类型决定 |
| `&T` | 一个指针 |
| `&mut T` | 一个指针 |
| `[]const T` | 两个 usize（指针 + 长度） |
| `String` | 两个 usize（指针 + 长度） + 堆上的字节 |

引用和切片都是**胖指针**：指向数据，同时带着编译器需要的元信息（生命周期、
元素类型、长度），而这些元信息在运行时不占额外空间。

## 一个绕不开的问题

> 「所有权 + 借用」能不能既安全，又像面向对象那样方便地共享可变状态？

答案是不能。Rust 用 `Rc<RefCell<T>>` 补上这块（第 10 章会讲到），
zr 目前没有提供等价物（`Rc` / `RefCell` 尚未实现）。
需要共享可变状态时的现实做法是：把状态放进 `Executor` 或通道后面，
用消息传递代替共享。

## 小结

| 机制 | 作用 | 运行时成本 |
|:-----|:-----|:-----------|
| 所有权 | 决定谁负责释放 | 编译器插入的析构调用点 |
| `Copy` / `Clone` | 显式选择复制 | 视类型而定 |
| 借用检查 | 禁止悬垂与别名写入 | 零 |
| 生命周期（NLL） | 描述引用存活区间 | 零 |
| 切片 | 零拷贝视图 | 两字指针 |

下一章：[3. 结构体与枚举](/learn/03-structs-enums/)。