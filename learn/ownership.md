---
title: 所有权与借用
description: zr 的内存安全机制：三条所有权规则、NLL 借用检查、生命周期标注，以及在需要时逃逸到 unsafe。
sidebar: learn
prev:
  title: 语法速览
  url: /learn/syntax/
next:
  title: 类型与 trait
  url: /learn/types/
---

内存安全是 zr 的默认状态，而不是一个可选模式。这一页解释它是怎么做到的。

## 所有权的三条规则

1. **每个值有且只有一个所有者。**
2. **当所有者离开作用域，值被自动释放**（调用其析构逻辑）。
3. **赋值、传参或返回会转移所有权**，除非该类型实现了 `Copy`。

```rust
let s1 = String::from_bytes("hello");
let s2 = s1;              // 所有权从 s1 转移到 s2
// println(s1);           // ❌ 编译错误：s1 已经失效

let s3 = s2.clone();      // 想要副本就显式克隆
println(s2);
println(s3);
```

编译器跟踪的是**编译期**的路径，不是运行时的引用计数：

```rust
fn take(s: String) -> usize {
    return s.len();       // s 在这里被销毁
}

let owned = String::from_bytes("zr");
let len = take(owned);
// println(owned);        // ❌ owned 已被移动
```

## 借用：不转移所有权

当你想「用一下但不要拿走」时，传入引用：

```rust
fn borrow(s: &String) -> usize {
    return s.len();
}

fn append(s: &mut String, c: u8) {
    s.push_byte(c);
}

let mut s = String::from_bytes("zr");
let len = borrow(&s);          // 不可变借用
append(&mut s, b'!');          // 可变借用
```

借用规则只有一条，但非常严格：

> **任意时刻，要么有任意多个不可变引用，要么恰好有一个可变引用。**

```rust
let mut data = Vec::new();

let r1 = &data;        // ✅ 多个不可变借用
let r2 = &data;        // ✅
let r3 = &mut data;    // ❌ 编译错误：data 已被不可变借用
```

### 借用检查在什么时候发生

zr 使用 **NLL（非词法生命周期）**：引用的存活期是它在程序里的**实际使用区间**，
而不是到作用域结尾为止。

```rust
let mut v = Vec::new();
v.push(1);

let first = &v[0];     // 不可变借用从这里开始
println(first);        // 到这里结束

v.push(2);             // ✅ 合法：不可变借用已经不再被使用
```

这意味着借用检查器几乎不会产生「误报」——它拒绝的借用冲突都是真的。

## 生命周期

当编译器无法从字面推断出引用的存活范围时，用标注告诉它：

```rust
// 返回值借用自两个输入中较短的那个
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { return x; }
    return y;
}
```

结构体中的生命周期参数：

```rust
struct Ref<'a, T> {
    value: &'a T,
}
```

`'a` 的含义是：`Ref` 实例不会活得比它内部的 `&'a T` 更久。

### 悬垂引用会被拒绝

```rust
fn dangling() -> &str {
    let local = String::from_bytes("oops");
    return &local;      // ❌ 编译错误：local 在函数结束时被销毁
}
```

生命周期检查保证了返回的引用永远指向仍然活着的内存 —— 这正是
「零成本抽象」能成立的前提：你不需要在运行时保存任何额外信息。

## 常见的所有权模式

### 借用优先

默认选择**借用**而不是移动。移动意味着放弃所有权，通常只在你确实要消费这个值时才用：

```rust
fn print_len(s: &String) { /* 只读，借用 */ }
fn consume(s: String)   { /* 拿走所有权 */ }
```

### 返回时转移

```rust
fn build() -> String {
    let mut s = String::from_bytes("zr");
    s.push_byte(b'!');
    return s;            // ✅ 把所有权移交给调用者
}
```

### `Copy` 与 `Clone`

实现了 `Copy` 的类型在赋值时按位复制，不触发移动：

```rust
let a = 42;              // i32 是 Copy
let b = a;               // ✅ a 仍然可用
```

`Clone` 是显式的深拷贝，需要你手动调用：

```rust
let a = String::from_bytes("zr");
let b = a.clone();       // ✅ 深拷贝，a 与 b 都可用
```

## 逃逸：`unsafe`

有些操作本质上无法被静态证明（调用 C、解引用裸指针、内联汇编）。
zr 没有假装这些是安全的，而是要求你显式声明：

```rust
unsafe {
    let ptr = 0x1000 as *mut u8;
    *ptr = 42;              // 危险操作，安全责任在你
}
```

`unsafe` **只关闭借用检查器**，其余所有检查（类型、生命周期、模式穷尽性）依然生效。
它是一个尽可能小的安全豁免面，而不是「关掉所有检查」。

## 切片：零拷贝的视图

切片是「一段连续内存 + 长度」的视图，传递它不会拷贝数据：

```rust
fn sum(values: []const i32) -> i32 {
    let mut total = 0;
    let mut i = 0;
    while i < values.len {
        total += values[i];
        i += 1;
    }
    return total;
}
```

这是 zr 里传递「一部分数组」的标准方式，`&str` 本身就是一个 `[]const u8` 的切片。

## 小结

| 机制 | 作用 | 运行时成本 |
|:-----|:-----|:-----------|
| 所有权 | 谁负责释放 | 析构调用点（编译期插入） |
| 借用检查 | 禁止悬垂与别名写入 | 零 |
| 生命周期 | 描述引用的存活区间 | 零 |
| `Copy` / `Clone` | 显式选择复制 | 视类型而定 |

## 下一步

- 类型推导、trait 约束求解与单态化 → [类型与 trait](/learn/types/)
- `Result` 与 `?` 的完整模型 → [错误处理](/learn/errors/)