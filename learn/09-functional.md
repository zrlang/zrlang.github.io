---
title: 9. 函数式编程特性
description: 闭包、迭代器、消费器与适配器——zr 的函数式工具箱。
sidebar: learn
status: planned
status_note: 闭包尚未实现；std/slice.zr 的高阶函数接受函数指针 fn(T) -> U。 迭代器模块依赖标准库，而后者目前仍编译不过。
prev:
  title: 8. 自动化测试
  url: /learn/08-testing/
next:
  title: 10. 智能指针
  url: /learn/10-pointers/
---

闭包让函数可以携带状态，迭代器让「遍历 + 变换」写成一个表达式。
两者组合起来是 zr 里表达复杂数据流的主要手段。

> **⚠️ 当前状态**：闭包尚未实现；`std/slice.zr` 里的高阶函数接受的是
> 函数指针 `fn(T) -> U`，不是闭包。本章按设计说明。

## 闭包

闭包是一个**捕获了外部变量的匿名函数**。

```rust
let factor = 3;
let multiply = |x: i32| -> i32 { return x * factor; };

println_int(multiply(7));     // 21
```

注意 `factor` 没有出现在参数列表里 —— 它被闭包捕获了。

### 捕获方式

捕获有三种，按情况自动选择：

| 情况 | 捕获方式 | 例子 |
|:-----|:---------|:-----|
| 只读 | 不可变借用 | `\|x\| x + factor` |
| 要改 | 可变借用 | `\|x\| { counter += 1; counter + x }` |
| 要消耗 | 移动（获取所有权） | `\|x\| consume(x)` |

这由所有权系统决定，和普通函数的传参规则是同一套。

```rust
let mut counter = 0;
let mut bump = || { counter += 1; };

bump();
bump();
println_int(counter);        // 2
```

### 接收闭包

```rust
fn apply_twice<T>(x: T, f: fn(T) -> T) -> T {
    return f(f(x));
}

fn call_with<T>(value: T, op: impl Fn(T) -> T) -> T {
    return op(value);
}
```

- `fn(T) -> T` 是**函数指针**类型，不能捕获环境变量。
- `impl Fn(T) -> T` 是**闭包**类型，可以捕获。`Fn` 是调用能力的标记。

zrust 的三个闭包 trait 对应三种调用方式：

| trait | 能力 |
|:------|:-----|
| `Fn` | 不可变引用调用，可多次调用 |
| `FnMut` | 可变引用调用，可多次调用 |
| `FnOnce` | 消耗 `self`，只能调用一次 |

约束越强，能接收的闭包种类越少；`Fn` 最宽松。

### 闭包的类型推断

类型签名通常能省略，编译器从第一次调用推断：

```rust
let double = |x| x * 2;
```

zr 的类型检查器有一步叫「闭包捕获分析」（`src/typeck`），
专门用来确定每个闭包捕获了哪些变量、按借用还是按所有权 —— 这在 MIR 阶段
决定 `λ` 捕获的实际实现方式。

## 迭代器

迭代器把「依次拿到下一个元素」这件事抽象成一个协议：

```rust
pub trait Iterator {
    type Item;
    fn next(self: &mut Self) -> Option<Self::Item>;
}
```

`for` 循环就是它的语法糖：

```rust
for x in arr {
    println_int(x);
}
```

大致脱糖成：

```rust
let mut iter = arr.iter();
loop {
    match iter.next() {
        Option::Some(x) => { /* 循环体 */ }
        Option::None    => break,
    }
}
```

因为是脱糖而非运行时魔法，**`for` 的开销为零** —— 和手写 `while` + 下标一样。

## 三个概念

| 概念 | 含义 | zr 的对应 |
|:-----|:-----|:----------|
| **消费器**（Consumer） | 消费迭代器产生副作用 | `fold`、`for_each` 类 |
| **迭代器**（Iterator） | 产生下一个元素 | `Iterator::next` |
| **适配器**（Adapter） | 惰性变换 | `map`、`filter` |

zr 把这套概念直接做成了 `std/slice.zr` 里的**自由函数**，而不是链式方法 ——
因为闭包尚未实现，链式方法表达力有限。

## 切片上的函数式 API

`std/slice.zr` 提供了一整套针对 `[]const T` / `[]mut T` 的函数：

### 取值

| 函数 | 返回 | 说明 |
|:-----|:-----|:-----|
| `first(s)` | `Option<T>` | 第一个元素 |
| `last(s)` | `Option<T>` | 最后一个元素 |
| `get(s, i)` | `T` | 按下标 |
| `index_of(s, item)` | `Option<usize>` | 线性查找 |
| `contains(s, item)` | `bool` | 线性查找 |
| `binary_search(s, key)` | `Option<usize>` | 二分查找，要求已排序 |

```rust
let s: []const i32 = arr;
let first = first(s);
let idx = binary_search(s, 30);       // Option::Some(2)
```

### 变换

| 函数 | 说明 |
|:-----|:-----|
| `map(s, f)` | 逐元素变换，返回新切片 |
| `filter(s, pred)` | 保留满足条件的元素 |
| `reverse(s)` | 原地反转 |
| `fill(s, value)` | 用同一个值填满，要求 `T: Copy` |
| `copy(dst, src)` | 切片间拷贝 |
| `sort(s)` | 原地排序，要求 `T: Ord` |

```rust
use slice::{map, filter};

let doubled = map(arr, double_fn);        // fn(i32) -> i32
let big     = filter(arr, is_even);       // fn(i32) -> bool
```

函数参数的类型写成 `fn(T) -> U`（函数指针）：

```rust
pub fn map<T, U>(s: []const T, f: fn(T) -> U) -> []U
pub fn filter<T: Copy>(s: []const T, pred: fn(T) -> bool) -> []T
pub fn fold<T, Acc>(s: []const T, init: Acc, f: fn(Acc, T) -> Acc) -> Acc
```

闭包落地后，这些参数会放宽为 `impl Fn`，届时可以直接写 `map(arr, |x| x * 2)`。

### 归约

| 函数 | 说明 |
|:-----|:-----|
| `sum(s)` | 求和 |
| `max(s)` / `min(s)` | 最大 / 最小，返回 `Option` |
| `reduce(s, f)` | 规约成单个值，返回 `Option` |
| `fold(s, init, f)` | 带初值的规约 |
| `any(s, pred)` / `all(s, pred)` | 是否存在 / 全部满足 |
| `find(s, pred)` | 找到第一个满足条件的元素 |

```rust
use slice::{sum, max, fold, any, find};

let total = sum(arr);                                  // i32
let hi    = max(arr);                                  // Option<i32>
let total2 = fold(arr, 0, add_fn);                     // fn(i32, i32) -> i32
let has_neg = any(arr, is_negative);
let first_even = find(arr, is_even);
```

`sum` / `max` / `min` / `reduce` 返回 `Option` 而不是直接给值，是因为
**空切片没有答案** —— 用类型把这个情况逼出来，而不是返回一个魔法值。

## 显式迭代器

需要手工控制时用迭代器对象：

```rust
use slice::{SliceIter, Range};

let mut it = SliceIter::new(arr);
loop {
    let p = it.next();
    if p == 0 as *mut i32 { break; }     // 耗尽时返回 null
    println_int(*p);
}
```

`next()` 返回指针而不是 `Option<T>`，耗尽时返回 `0 as *mut T`。
这是底层实现的选择 —— 迭代器本身就在编译器内部大量使用。

### 区间迭代器

```rust
use slice::Range;

let mut r = Range::new(0, 10);          // 0..10，含 0 不含 10
while r.next() != 0 as *mut i64 {
    println_int(*r.current);
}

// 带步长
let mut step = slice::range_step(0, 100, 10);
```

`Range` 的步长方向由 `end >= start` 自动决定，所以它同时支持倒序区间。

## 与 `for` 的选择

| 场景 | 用什么 | 为什么 |
|:-----|:-------|:-------|
| 需要下标 | `while` + `i` | 直接 |
| 只要值 | `for x in s` | 脱糖成 `next`，无开销 |
| 只要变换结果 | `map` / `filter` | 表意清楚 |
| 需要提前退出 | `find` / `any` / `all` | 返回 `Option`/`bool` |

zr 的哲学是**显式优于隐式**：`std/slice.zr` 提供的是命名清晰的自由函数，
而不是一条需要回忆顺序的 `.iter().filter().map().collect()` 链。

## 小结

| 概念 | zr 写法 | 状态 |
|:-----|:---------|:-----|
| 闭包 | `\|x\| expr` | ✘ 未实现 |
| 函数指针 | `fn(T) -> U` | ✔ |
| `impl Fn` | `impl Fn(T) -> T` | 设计完成 |
| 迭代器 trait | `Iterator::next -> Option<Self::Item>` | ✔ |
| `for x in s` | 脱糖成 `next` | ✘ 依赖循环实现 |
| 适配器 | `map` / `filter` / `sort` … | ✔ `std/slice.zr` |
| 消费器 | `fold` / `reduce` / `any` / `all` | ✔ |

下一章：[10. 智能指针](/learn/10-pointers/)。