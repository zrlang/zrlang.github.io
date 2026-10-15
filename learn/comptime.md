---
title: comptime 编译期求值
description: 在编译期计算常量、生成代码、用类型信息做反射 —— comptime 把元编程变成语言的一部分。
sidebar: learn
prev:
  title: 异步与协程
  url: /learn/async/
next:
  title: 嵌入式与交叉编译
  url: /learn/embedded/
---

Rust 有 `const fn`，Zig 有 `comptime`。zr 两者都提供，但 `comptime` 更彻底：
它可以在**编译期**执行任意被允许的 zr 代码，并把结果固化到产物里。

> **状态**：编译期求值的完整实现计划在 v0.6.0 落地。本页描述的是设计目标与已确定的语义。

## 编译期函数

```rust
/// 编译期计算阶乘
comptime fn fact(n: i32) -> i32 {
    if n <= 1 { 1 } else { n * fact(n - 1) }
}

const SIZE: usize = fact(5);   // 编译期求值为 120
```

用 `const` 声明的值必须在编译期可求值。如果表达式里有函数调用，编译器会
尝试把它当作 comptime 求值；求不出来就是编译错误 —— 这正是它的价值：
**编译期常量一定是常量**。

## 类型反射

`@typeInfo(T)` 在编译期返回一个描述类型结构的值，可以 `match`：

```rust
fn make_default<T>() -> T {
    comptime match @typeInfo(T) {
        .Struct  => T::default(),
        .Int     => 0 as T,
        .Pointer => null,
        else     => unreachable(),
    }
}
```

这让「根据类型生成不同的代码」成为可能，而不需要宏。

## 编译期数据结构

`comptime` 上下文里可以创建容器，它们在编译结束后被丢弃，不会进入产物：

```rust
comptime {
    // 编译期构造一个表，运行时零成本
    var table: [256]u8 = undefined;
    var i = 0;
    while i < 256 {
        table[i] = @popCount(i);
        i += 1;
    }
    return table;
}
```

这类表（CRC 查找表、S-box、跳转表）通常由库手写或用 C 生成；
在 zr 里可以直接写出来。

## 属性与条件编译

属性可以读取编译期信息：

```rust
#[cfg(target_arch = "x86_64")]
fn memcpy_fast(dst: *mut u8, src: *const u8, n: usize) {
    // 目标相关的实现
}

#[cfg(not(target_arch = "x86_64"))]
fn memcpy_fast(dst: *mut u8, src: *const u8, n: usize) {
    // 通用实现
}

#[export("zr_main")]
fn exported_main() i32 { return 0; }
```

## comptime vs const fn

| | `const fn` | `comptime` |
|:--|:-----------|:-----------|
| 可以读类型信息 | ✘ | ✔ |
| 可以 `match` 类型结构 | ✘ | ✔ |
| 可以构建编译期容器 | ✘ | ✔ |
| 可以在编译期调用非 comptime 代码 | ✘ | 受限（需 `comptime` 调用） |
| 面向 | 编译期常量 | 元编程 |

## 设计约束

`comptime` 不能做的事：

- **不能有副作用** —— 不写文件、不发起 I/O、不读环境变量。编译必须是纯函数。
- **不能无限循环** —— 递归深度与迭代次数有硬上限，避免编译期死循环。
- **不能依赖运行期状态** —— 因此「用 comptime 读取配置文件」是刻意不支持的；
  配置应在 `zr` 命令行上以生成代码的方式传入。

## 下一步

- 把程序编译到树莓派 / STM32 / WebAssembly → [嵌入式与交叉编译](/learn/embedded/)
- `comptime` 的实现计划 → [路线图](/community/roadmap/)