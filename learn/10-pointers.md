---
title: 10. 智能指针
description: Box&lt;T&gt;、堆分配、裸指针，以及 zr 为什么没有 Rc 与 RefCell。
sidebar: learn
status: partial
status_note: v0.7.0 已实现最小 SSA 内存模型：&x 取址、*p / *p = v / p[i]、 指针算术 p + n / p - q，以及 x86-64 与 AArch64 各自的栈槽方案。 Box / Rc / RefCell 这类智能指针仍未实现；栈溢出目前仅 x86-64 有。
prev:
  title: 9. 函数式编程特性
  url: /learn/09-functional/
next:
  title: 11. 并发编程
  url: /learn/11-concurrency/
---

Rust 用 `Box` / `Rc` / `RefCell` 三件套处理堆分配与内部可变性。
zr 目前只有裸指针层面的原语 —— 这一章讲清楚**有什么、没有什么，以及为什么**。

> **⚠️ 当前状态**：v0.7.0 已实现**最小 SSA 内存模型** —— 裸指针的取址、解引用、
> 索引与指针算术都能编译并正确运行（用例 `24_pointers.zr`），见本章「裸指针」一节。
> 但 `Box<T>` / `Rc<T>` / `RefCell<T>` 这类带所有权语义的智能指针仍未实现。

## `Box<T>`：把值放到堆上

```rust
let b = Box::new(42);
let v = *b;              // 解引用取值
```

`Box<T>` 是**独占所有权**的堆指针：它指向堆上的 `T`，并且保证没有第二个所有者。
离开作用域时自动释放内存。

zr 的标准库里有对应的原语（`std/mem.zr`）：

```rust
use mem::{box_new, box_free, Allocator, SystemAllocator, Layout};

// 分配并拷贝一个值
let p = box_new(42);
let v = *p;
box_free(p);
```

| 函数 | 说明 |
|:-----|:-----|
| `box_new<T: Clone>(value)` | 分配 + 拷贝，返回 `*mut T` |
| `box_free<T>(ptr)` | 释放 |

注意 zr 的 `box_new` 返回的是**裸指针**而不是一个 `Box<T>` 值。
`Box<Self>` 作为类型在标准库内部有出现（`std/async.zr` 的 `Wake::wake(self: Box<Self>)`），
但对外的构造与释放接口是 `box_new` / `box_free` 这一对裸指针函数。

### 为什么需要它

三种情况必须把数据放到堆上：

1. **递归类型** —— 大小在编译期必须有限。
2. **大小不确定的数据** —— `Vec<T>` 的容量是运行时决定的。
3. **要移动但不拷贝** —— 大结构体在函数间传递时只搬指针。

```rust
// 递归类型：List<T> 大小取决于 Cons 里的 Box<List<T>>，
// 而那个 Box 的指向内容大小又是 List<T> —— 用 Box 打断无限展开
pub enum List<T> {
    Nil,
    Cons(T, Box<List<T>>),
}
```

### 解引用

```rust
let p = box_new(42);
let v = *p;              // 裸指针解引用
```

`std/mem.zr` 还提供了这些低层工具：

| 函数 | 说明 |
|:-----|:-----|
| `write<T>(dst, value)` | 向地址写值 |
| `read<T>(src)` | 从地址读值 |
| `zeroed<T>()` | 全零值 |
| `transmute<Src, Dst>(src)` | 按位重解释 |
| `size_of<T>()` / `align_of<T>()` | 大小 / 对齐 |
| `drop<T>(value)` | 显式释放 |
| `forget<T>(value)` | 故意泄漏（不释放） |

## 分配器

zr 把分配抽象成一个 trait，和 Rust 一样允许换掉全局分配器：

```rust
pub trait Allocator {
    fn allocate(layout: Layout) -> *mut void;
    fn deallocate(ptr: *mut void, layout: Layout);
}

pub struct SystemAllocator;

impl Allocator for SystemAllocator {
    // ...
}
```

`Layout` 把「大小 + 对齐」打包成一个值，保证分配与释放用同一份描述：

```rust
let layout = Layout::new::<i32>();
let p = alloc(layout);
// ...
dealloc(p, layout);
```

## `Rc<T>` 与 `RefCell<T>`：zr 的缺口

Rust 用这两个类型补上「安全地共享可变状态」：

| 类型 | Rust 的作用 | zr |
|:-----|:------------|:-----|
| `Rc<T>` | 多个所有者，共享不可变数据 | ✘ |
| `RefCell<T>` | 运行时借用检查（内部可变性） | ✘ |
| `Cell<T>` | 单值读写，无借用检查 | ✘ |
| `Arc<T>` / `Mutex<T>` | 跨线程共享 | ✘ |
| `Weak<T>` | 打破循环引用 | ✘ |

zr 只有 `std/core.zr` 里的一个 `Hash` trait，没有引用计数与内部可变性。

### 为什么这是个真实的限制

`[2. 所有权系统](/learn/02-ownership/) 里说过：所有权 + 借用**不能**同时给出
「安全」和「像面向对象那样方便地共享可变状态」。Rust 用 `Rc<RefCell<T>>` 补，
zr 目前没有补。

所以现在需要共享可变状态时，实践上是：

1. **消息传递** —— 用通道把可变状态关进单个协程（见 [11. 并发编程](/learn/11-concurrency/)）。
2. **收窄作用域** —— 用 `&mut` 把可变借用限制在最小范围内，不要让它跨函数。
3. **回到 unsafe** —— 自己用原子操作或锁保护（见 [14. 高级特性](/learn/14-advanced/)）。

这确实比 Rust 麻烦。zr 的一条设计哲学是「显式优于隐式」，
但「内部可变性」的缺失更像是待补的能力而不是有意的取舍 —— 它没有出现在
`future/` 的任何一份设计文档里。

## 循环引用与泄漏

即便在 Rust 里，引用计数也不是完整的答案：

```rust
// a 指向 b，b 指向 a —— 引用计数永远降不到 0
```

zr 没有引用计数，所以这个问题目前不成立 —— 因为共享本身就不支持。
这是「能力缺失」带来的一个意外好处。

## 裸指针

最后，所有权系统有一个显式的出口：`unsafe` 里的裸指针。

```rust
let p = 0x1000 as *mut u8;
*p = 42;              // 危险操作，安全责任在你
```

| 函数 | 说明 |
|:-----|:-----|
| `is_null<T>(ptr)` | 是否为空 |
| `offset<T>(ptr, count)` | 按元素偏移 |
| `memcpy` / `memmove` / `memset` / `memcmp` | 内存块操作 |
| `memswap<T>(a, b)` | 交换两块内存 |

`memcpy` 要求两块区域不重叠，`memmove` 允许重叠 —— 和 C 的语义一致。
指针与内联汇编的完整说明见 [14. 高级特性](/learn/14-advanced/)。

## 小结

| 能力 | zr 现状 |
|:-----|:---------|
| `Box<T>` 类型 | 标准库内部使用 |
| `box_new` / `box_free` | ✔ `std/mem.zr` |
| `Allocator` trait / `Layout` / `SystemAllocator` | ✔ |
| `transmute` / `zeroed` / `size_of` | ✔ |
| 裸指针 + `unsafe` | ✔ |
| `Rc<T>` | ✘ |
| `RefCell<T>` / `Cell<T>` | ✘ |
| `Arc<T>` / `Weak<T>` | ✘ |

下一章：[11. 并发编程](/learn/11-concurrency/)。