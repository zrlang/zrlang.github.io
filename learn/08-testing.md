---
title: 8. 自动化测试
description: zr 的断言、用例组织方式、宿主侧运行器，以及 #[test] 的规划。
sidebar: learn
status: ready
status_note: >-
  cargo test --test zr_language 驱动 tests/cases/*.zr 下的 26 个自检用例，
  每个用例在 -O0 到 -Oz 各编译运行一遍。v0.6.0 起 #[test] 测试桩已实现，
  但还没有 zr test 子命令接运行器。
prev:
  title: 7. 泛型、Trait 与生命周期
  url: /learn/07-generics/
next:
  title: 9. 函数式编程特性
  url: /learn/09-functional/
---

Rust 用 `#[test]` + `cargo test` 做测试。zr 的现状不同：**`#[test]` 属性能被
解析，但还没有语言内的测试运行器**。目前是用宿主侧的 Rust 运行器驱动
「自检式的 `.zr` 程序」。

> **⚠️ 当前状态**：`#[test]` 测试桩已在 v0.6.0 落地，但还没有 `zr test` 子命令
> 去接运行器。本章讲的是当前可行的写法（自检用例 + 宿主运行器）。

## 核心约定：自检程序

zr 的测试用例是**自检程序**：一个 `.zr` 文件，里面是一组 `fn test_xxx()`，
每个返回 `0` 表示通过、返回非 0 表示失败。

```rust
use io::{println, println_int};
use core::{assert, assert_eq};

fn test_scalars() -> i32 {
    let a = 2 + 3;
    assert_eq(a, 5, "整数加法");
    return 0;
}

fn test_comparisons() -> i32 {
    assert(1 < 2, "小于");
    assert(2 != 3, "不等");
    return 0;
}

fn main() -> i32 {
    // 依次调用每个用例
    if test_scalars() != 0 { return 1; }
    if test_comparisons() != 0 { return 2; }
    return 0;
}
```

仓库里的 `tests/cases/*.zr` 就是这个形态。约定是：

- 全部断言通过时 `main` 返回 `0`；
- 失败时返回一个**非 0 的编号**，直接指向失败的断言（见文件内注释）。

## 断言

```rust
use core::{assert, assert_eq, panic};

assert(count >= 0, "计数不能为负");
assert_eq(actual, expected, "求和不匹配");
```

| 函数 | 作用 |
|:-----|:-----|
| `assert(cond, msg)` | 条件为假则 panic |
| `assert_eq(a, b, msg)` | 要求 `a == b`（要求 `T: Eq`） |
| `panic(msg)` | 显式失败 |

第三个参数是消息，取 `[]const u8` 或 `&'static str`。

> 与 Rust 的差别：Rust 的 `assert!` / `assert_eq!` 是**宏**，消息可以是任意
> `format!` 字符串。zr 目前只有函数形态，所以不能插值 —— 消息必须是一个
> 静态字符串。这是尚未完成的部分之一。

## 宿主侧运行器

`tests/zr_language.rs` 是一个 Rust 测试，它遍历 `tests/cases/*.zr`，
调用 `zr` 编译并执行，然后检查退出码：

```bash
cargo test --test zr_language
```

之所以用宿主运行器而不是语言内的 `#[test]`，仓库的 `tests/README.md` 给出的
原因是：`#[test]` 属性、断言内建、闭包这些设施编译器目前还不支持。

### 用例怎么组织

`tests/cases/` 按《Rust 程序设计语言》的章节顺序命名：

| 用例 | 对应章节 |
|:-----|:---------|
| `01_variables.zr` | 变量与可变性：`let` / `mut` / shadowing |
| `02_scalars.zr` | 数据类型：整数标量与 `+ - * / %` |
| `03_precedence.zr` | 运算符：优先级、括号、结合性 |
| `04_comparisons.zr` | 运算符：`== != > >=` |
| `05_logic.zr` | 运算符：布尔字面量、`!` `\|\|` |
| `06_functions.zr` | 函数：定义、参数、返回值、嵌套调用 |
| `07_control_flow.zr` | 控制流：`if` / `else`、分支早返回 |
| `08_three_args.zr` | 函数：三参数调用（寄存器分配） |

新增一个用例就是新增一个 `.zr` 文件，运行器会自动发现它。

### ⚠️ 写用例时的限制

当前的寄存器分配器没有活跃性分析（`alloc_reg` 按 SSA 编号取模映射到固定
寄存器池），**同一条语句链上的语句越多越容易串值**。所以：

- 辅助函数保持无分支（`return a + b;` 这类），断言全部放在 `main`；
- `main` 里的断言控制在 3～6 条；
- 三参数以上的调用单独成文件。

这些限制会随着寄存器分配器的实现而消失。

## 语言内测试：规划

`#[test]` 的设计已经确定，只是运行器还没接上：

```rust
#[test]
fn test_basic() {
    assert_eq(1 + 1, 2);
}
```

跑起来是 `zr test`（排在 v0.7.0，和 `zr fmt`、LSP 一起）。
配套需要的东西：

| 需要的能力 | 当前状态 |
|:------------|:---------|
| `#[test]` 属性解析 | ✔ 能解析 |
| 测试函数注册与发现 | ✘ |
| 断言宏（可插值消息） | ✘ 目前只有函数形态 |
| 测试名过滤（`zr test <name>`） | ✘ |

## 集成测试

Rust 区分「单元测试」（同文件内 `mod tests`）和「集成测试**（`tests/` 下每个文件独立编译）。

zr 目前是单文件编译，**没有集成测试的对应物**。`tests/cases/*.zr` 里的每个文件
反而更接近集成测试：它是独立编译、独立运行的完整程序。

## 测试什么

参考 `tests/cases/` 的取舍，一个好的 zr 用例会覆盖：

- **边界值** —— `0`、负数、类型下溢；
- **运算符优先级** —— `2 + 3 * 4` 与 `(2 + 3) * 4`；
- **提前返回的路径** —— 守卫条件命中与不命中；
- **寄存器压力** —— 三参数调用等容易暴露串值的场景。

暂时测不了的（编译器未实现）：循环、递归、借用、枚举、`match`、泛型、
闭包、`Result`。完整清单见仓库的 `tests/README.md`。

## 小结

```bash
# 跑语言测试（宿主运行器）
cargo test --test zr_language

# 单独编译一个用例
zr tests/cases/01_variables.zr -o /tmp/t1 && /tmp/t1
```

| 能力 | zr 现状 |
|:-----|:---------|
| `assert` / `assert_eq` | 设计完成，未实现 |
| 自检式用例程序 | ✔ 仓库现状 |
| 宿主侧运行器 | ✔ `cargo test --test zr_language` |
| `#[test]` 属性 | 能解析，未接入 |
| `zr test` 子命令 | ✘ 规划中（v0.7.0） |
| 可插值的断言消息 | ✘ |

下一章：[9. 函数式编程特性](/learn/09-functional/)。