---
title: 5. 集合类型
description: Vec&lt;T&gt; 与 String 的完整 API，以及为什么 zr 目前没有 HashMap。
sidebar: learn
status: planned
status_note: <code>std</code> 中对应的模块目前仍编译不过。
prev:
  title: 4. 包与管理项目
  url: /learn/04-project/
next:
  title: 6. 错误处理
  url: /learn/06-errors/
---

动态增长的集合是日常代码里用得最多的两个类型：`Vec<T>` 和 `String`。
zr 的实现写在 `std/collections.zr` 与 `std/string.zr` 里，都是纯 zr 代码。

> **⚠️ 当前状态**：这两个模块目前仍编译不过。本章是设计说明 + API 参考。

## 为什么没有 `HashMap`

Rust 有 `Vec<u8, V>`（哈希表）。zr 的 `std/` 里**没有** `HashMap`：

| 能力 | Rust | zr |
|:-----|:-----|:----|
| 动态数组 | `Vec<T>` | `Vec<T>` ✔ |
| 可增长字符串 | `String` | `String` ✔ |
| 哈希表 | `HashMap<K, V>` | ✘ |
| 关联列表 | `Vec<(K, V)>` + `iter().find()` | `Vec<(K, V)>` + 线性查找 ✔ |
| 排序集合 | `BTreeMap<K, V>` | ✘ |

替代方案是**关联列表**：用一个 `Vec<(K, V)>` 手动实现。规模不大时线性查找完全够用，
而且没有哈希函数的不可预测性：

```rust
use collections::Vec;

fn find<K, V>(pairs: &Vec<(K, V)>, key: K) -> Option<V>
where K: Eq, V: Clone
{
    let mut i = 0;
    while i < pairs.len {
        let pair = pairs.get(i);
        if pair.0 == key {
            return Option::Some(pair.1);
        }
        i += 1;
    }
    return Option::None;
}
```

`std/core.zr` 里定义了 `Hash` trait，但目前没有配套的哈希容器。
如果你需要哈希表，这是目前唯一现实的路径。

## `Vec<T>`

`Vec<T>` 是连续内存的动态数组。所有元素在堆上连续存放，因此索引是 O(1)，
遍历对缓存友好。容量按倍数增长。

```rust
use collections::Vec;

let mut v = Vec::new();
v.push(1);
v.push(2);
v.push(3);

let first = v.get(0);        // i32（越界会 panic）
let n = v.len();             // usize
```

### 创建

| 方法 | 说明 |
|:-----|:-----|
| `Vec::new()` | 空向量 |
| `Vec::with_capacity(cap)` | 预留容量，避免反复扩容 |
| `Vec::filled(count, value)` | 长度 `count`、全部填 `value` |
| `vec_from_array(arr)` | 从 `[T; N]` 数组转换 |

```rust
let mut v = Vec::with_capacity(1024);   // 已知大概要放多少，先预留
let mut filled = Vec::filled(16, 0);
```

### 增删改查

| 方法 | 签名 | 说明 |
|:-----|:-----|:-----|
| `push` | `(self: &mut Vec<T>, value: T)` | 末尾追加 |
| `pop` | `(self: &mut Vec<T>) -> Option<T>` | 弹出最后一个 |
| `get` | `(self, index: usize) -> T` | 按索引取值，越界 panic |
| `get_ref` | `(self, index: usize) -> *const T` | 取指针，不拷贝 |
| `get_mut` | `(self, index: usize) -> *mut T` | 取可变指针 |
| `insert` | `(self: &mut Vec<T>, index, value)` | 在 `index` 处插入，后续元素后移 |
| `remove` | `(self: &mut Vec<T>, index) -> Option<T>` | 移除并返回，后续元素前移 |
| `clear` | `(self: &mut Vec<T>)` | 全部清空 |
| `destroy` | `(self: &mut Vec<T>)` | 释放底层内存 |

```rust
let mut v = Vec::new();
v.push(10);
v.push(20);

v.insert(1, 99);       // [10, 99, 20]

let popped = v.pop();  // Option::Some(20)
let removed = v.remove(0);  // Option::Some(10)
```

注意 `insert` / `remove` 都需要移动后续元素，O(n)。在中间插入是 `Vec` 的主要开销来源。

### 查询与排序

| 方法 | 返回 | 说明 |
|:-----|:-----|:-----|
| `len()` | `usize` | 元素个数 |
| `capacity()` | `usize` | 已分配容量 |
| `is_empty()` | `bool` | |
| `contains(item)` | `bool` | 线性查找 |
| `index_of(item)` | `Option<usize>` | 找到返回下标 |
| `sort()` | — | 原地排序，要求 `T: Ord` |

### 与切片互转

| 方法 | 说明 |
|:-----|:-----|
| `as_slice()` | `[]const T` |
| `as_mut_slice()` | `[]mut T` |
| `reserve(additional)` | 预留额外空间 |
| `shrink_to_fit()` | 收缩到刚好装下 |

拿到切片后可以用 `std/slice.zr` 的全套函数（见 [9. 函数式编程特性](/learn/09-functional/)）：

```rust
let s = v.as_slice();
println_int(sum(s) as i64);
```

### 元素是 `T: Copy` 时更快

`get` 返回 `T` 本身，`get_ref` 返回 `*const T`。对 `i32` 这类 `Copy` 类型两者
开销一样；对 `String` 这类大对象，`get_ref` 能避免一次拷贝。

## `String`

`String` 是可增长的、可变长的 UTF-8 字节串。所有权语义和其他 zr 类型一致：
移动 `String` 会转移底层堆内存的释放责任。

```rust
use string::String;

let mut s = String::new();
s.push_byte(b'h');
s.push_str(&other);
s.push_int(42);
```

### 创建与容量

| 方法 | 说明 |
|:-----|:-----|
| `String::new()` | 空字符串 |
| `String::from_bytes(b)` | 从字节切片创建 |
| `String::from_cstr(p)` | 从 C 风格字符串创建 |
| `String::with_capacity(cap)` | 预留容量 |
| `len()` / `capacity()` / `is_empty()` | 查询 |
| `reserve(n)` / `clear()` / `destroy()` | 容量与清空 |

zr 的字符串**不保证是 UTF-8**（`push_byte` 可以塞任意字节），底层就是
字节数组加 UTF-8 的约定。

### 追加

| 方法 | 说明 |
|:-----|:-----|
| `push_byte(b: u8)` | 追加一个字节 |
| `push(c: char)` | 追加一个字符 |
| `push_bytes(b: []const u8)` | 追加一段字节 |
| `push_str(s: &String)` | 追加另一个字符串 |
| `push_int(n: i64)` | 追加整数的十进制文本 |
| `push_uint(n: u64)` | 追加无符号整数的十进制文本 |

```rust
let mut s = String::from_bytes("total: ");
s.push_int(42);          // "total: 42"
```

注意 zr 没有 `format!` 宏，格式化输出走 `io::print_fmt`：

```rust
use io::{println, print_fmt, FormatArg};

print_fmt("{} + {} = {}\n", &[
    FormatArg::Int(40), FormatArg::Int(2), FormatArg::Int(42)
]);
```

### 查询与查找

| 方法 | 返回 | 说明 |
|:-----|:-----|:-----|
| `as_bytes()` | `[]const u8` | 底层字节视图 |
| `eq(other)` | `bool` | 内容相等 |
| `cmp(other)` | `i32` | 字典序比较 |
| `contains(needle)` | `bool` | 子串 |
| `starts_with(prefix)` | `bool` | 前缀 |
| `ends_with(suffix)` | `bool` | 后缀 |
| `find_byte(b)` | `Option<usize>` | 找单个字节的下标 |
| `substr(start, end)` | `String` | 取子串（新建字符串） |

```rust
let s = String::from_bytes("hello");
assert(s.starts_with("he"), "starts_with");
assert(s.ends_with("lo"), "ends_with");
assert(s.contains("ell"), "contains");
```

### 其他

| 方法 | 说明 |
|:-----|:-----|
| `reverse()` | 原地反转字节 |
| `concat(a, b)` | 拼接两个字符串（关联函数） |
| `repeat(bytes, count)` | 重复若干次 |

### 与 `&str` 的关系

`&str` 是一个 `[]const u8` 的切片，不是独立类型。函数签名里最常见的是：

```rust
fn takes_str(s: &str) -> i32 { return 0; }
```

这样它既接受 `&String`，也接受字面量 `"hello"` —— 后者编译器会临时构造成
`[]const u8`。这比 Rust 里 `AsRef<str>` 那套隐式转换直接得多。

## 内存与性能

| 操作 | 复杂度 | 备注 |
|:-----|:-------|:-----|
| `get(i)` | O(1) | 越界 panic |
| `push` | 均摊 O(1) | 容量翻倍 |
| `insert(i, v)` / `remove(i)` | O(n) | 移动后续元素 |
| `contains` / `index_of` | O(n) | 线性 |
| `sort` | O(n log n) | 要求 `T: Ord` |
| 拿 `as_slice()` 后遍历 | O(n) | 顺序访问，对缓存友好 |

`with_capacity` / `reserve` 能在已知规模时避免反复扩容 —— 这是最常见的
一处性能损失来源。

## 小结

| 类型 | 用途 | zr 现状 |
|:-----|:-----|:--------|
| `Vec<T>` | 动态数组 | ✔ 设计完成，模块暂编译不过 |
| `String` | 可增长字节串 | ✔ 同上 |
| `[]const T` / `[]mut T` | 零拷贝视图 | ✔ |
| `HashMap<K, V>` | 哈希表 | ✘ 用 `Vec<(K, V)>` 替代 |

下一章：[6. 错误处理](/learn/06-errors/)。