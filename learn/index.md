---
title: zr 教程
description: 按《Rust 程序设计语言》的章节顺序组织的 zr 入门到进阶教程，附当前编译器的实现状态。
sidebar: learn
prev: null
next:
  title: 安装与第一个程序
  url: /learn/getting-started/
---

zr 教程按《Rust 程序设计语言》（The Rust Book）的章节顺序组织，14 章，
从变量与函数一路走到 `unsafe`、宏与跨平台。

> **请先读这一段。** zr 编译器正在快速推进。**v0.6.0 里程碑已经全部完成**，
> 语言测试用例从最早的 8 个增加到 **25 个**：变量、标量、浮点、函数、递归、
> 全部循环、`if`/`else` 作为表达式、`match` 脱糖语义、`comptime`、`as` 转换、
> 指针与 `.rodata` 字符串都能编译并正确运行（在 `-O0` 到 `-Oz` 各验证一遍）。
>
> 但**语言层面的大块还没动**：所有权与借用、结构体字段与枚举、切片、
> `Vec`/`String`、`Result`、泛型/trait、闭包、线程。
>
> 所以本教程的定位是：**14 章写全了语言设计，每章顶部标注了真实实现状态。**
> 标注为「尚未实现」的章节不要指望代码能跑。完整进展见
> [项目进展](/community/roadmap/)。

## 开始之前

| 我想…… | 去这里 |
|:-------|:-------|
| 装好编译器，跑第一个程序 | [安装与第一个程序](/learn/getting-started/) |
| 知道现在到底能写什么 | 看下面的[实现状态](#实现状态) |
| 看编译器是怎么把这些变成机器码的 | [编译器架构](/tools/architecture/) |

## 实现状态

下面的状态直接来自 zr 仓库的 `tests/README.md`，不是估计值。
侧边栏里的圆点用同样的颜色标记。

| 章节 | 内容 | 状态 |
|:-----|:-----|:-----|
| [安装与第一个程序](/learn/getting-started/) | 构建编译器、编译与运行、交叉编译 | ● 已通过测试 |
| [1. 基础语法](/learn/01-syntax/) | 变量、标量与浮点、函数、递归、循环 | ◐ 仅缺 `for` |
| [2. 所有权系统](/learn/02-ownership/) | 所有权、借用、切片 | ○ 尚未实现 |
| [3. 结构体与枚举](/learn/03-structs-enums/) | `struct`、`impl`、`enum`、`Option` | ○ 尚未实现 |
| [4. 包管理与项目](/learn/04-project/) | `zr pkg` / `fmt` / `lsp`、增量编译 | ◐ 路径依赖 |
| [5. 集合类型](/learn/05-collections/) | `Vec<T>`、`String` | ○ 尚未实现 |
| [6. 错误处理](/learn/06-errors/) | `panic`、`Result`、`?` | ○ 尚未实现 |
| [7. 泛型、Trait 与生命周期](/learn/07-generics/) | 泛型、trait、生命周期 | ○ 尚未实现 |
| [8. 自动化测试](/learn/08-testing/) | 断言、25 个用例、跨优化等级运行器 | ◐ 无 `zr test` |
| [9. 函数式编程特性](/learn/09-functional/) | 闭包、迭代器、适配器 | ○ 尚未实现 |
| [10. 智能指针](/learn/10-pointers/) | 指针、内存模型、栈槽 | ◐ 无 `Box`/`Rc` |
| [11. 并发编程](/learn/11-concurrency/) | 协程、`async`、通道 | ○ 尚未实现 |
| [12. 面向对象特性](/learn/12-oop/) | 封装、trait 对象、状态模式 | ○ 尚未实现 |
| [13. 模式匹配](/learn/13-patterns/) | `match` 脱糖、绑定臂、守卫 | ◐ 仅字面量类 |
| [14. 高级特性](/learn/14-advanced/) | `comptime`、属性、FFI、跨平台 | ◐ 无宏/asm |

● 已通过测试　◐ 部分可用　○ 尚未实现

### 已经能跑的部分

`tests/cases/` 下 26 个用例覆盖的内容：

| 领域 | 用例 |
|:-----|:-----|
| 变量与标量 | `01_variables`、`02_scalars`、`03_precedence`、`04_comparisons`、`05_logic`、`13_casts`、`21_literal_suffixes` |
| 函数 | `06_functions`、`08_three_args`、`22_call_preserve` |
| 控制流 | `07_control_flow`、`09_while`、`10_if_expression`、`11_if_else_chain`、`15_loops`、`17_loop_break` |
| 编译期求值 | `12_comptime`、`16_comptime_fn` |
| 浮点 | `19_float`、`20_f32` |
| 寄存器溢出 | `14_spill`、`18_spill_ops` |
| 字符串与指针 | `23_strings`、`24_pointers` |
| 模式匹配 | `25_match`（脱糖成 if/else 链） |
| 结构体与 Drop | `26_comptime_struct` |

也就是说：**变量、算术、浮点、函数调用、递归、循环、`if`/`else` 表达式、
`match` 字面量模式、`comptime`、`as` 转换、指针与字符串字面量、结构体与
Drop 析构**。

还不能用：`for`、所有权与借用、结构体字段与枚举、切片、集合、
`Result`、泛型/trait、闭包、线程。

跑一遍：

```bash
cargo test --test zr_language
```

### 为什么教程比编译器走得更远

因为 zr 的材料组织方式是「标准库即规范」：`std/` 里那 3900 行代码
定义了 `Vec`、`String`、`async`、`net`、SIMD 的完整 API，
它们的错误处理、借用、trait 用法都是真实写出来的代码，
比任何设计文档都更接近「这门语言应该长什么样」。

本教程的写法是：**从标准库源码倒推语言设计**，而不是照抄 README 的宣传。
遇到 README 与源码矛盾时以源码为准，并在正文里标出来
（例如可变绑定 README 写 `var`，实际全部是 `let mut`）。

## zr 的设计哲学

| # | 原则 |
|:--|:-----|
| 1 | **显式优于隐式** —— 每个内存操作、所有权转移、错误处理都清晰可见 |
| 2 | **零成本抽象** —— 高层糖在编译期完全消除，运行时等同手写 C |
| 3 | **内存安全是默认** —— 不牺牲安全性换性能 |
| 4 | **渐进式复杂度** —— 从 `let x = 1` 到协程、`comptime`，按需深入 |
| 5 | **工具链即语言的一部分** —— 编译器、格式化器、文档生成器、包管理器是同一整体 |
| 6 | **与 C 共存** —— 不是取代 C，而是更好地使用 C |

## 和 Rust 的关键差异

| 方面 | Rust | zr |
|:-----|:-----|:----|
| 可变绑定 | `let mut` | `let mut`（README 写的 `var` 尚未实现） |
| 尾表达式返回 | 支持 | 必须显式 `return` |
| 并发模型 | 线程 + `Future` | **只有协程**，没有线程 |
| 包管理 | Cargo + crates.io | `zr pkg`，目前只有路径依赖 |
| 格式化 / LSP | rustfmt / rust-analyzer | `zr fmt` / `zr lsp` |
| 哈希表 | `HashMap` | 无，用 `Vec<(K, V)>` 替代 |
| 内部可变性 | `Rc<RefCell<T>>` | 无 |
| 标准库 | 编译进 `rustc` | **用 zr 自己写**，按需加载 |
| 后端 | LLVM（默认） | **自研**，不依赖 LLVM |
| 隐式转换 | 有限（`From`/`Into`） | 只有显式 `as` |

## 三分钟版本（这段现在能编译）

```rust
fn fib(n: i32) -> i32 {
    if n <= 1 { return n; }
    return fib(n - 1) + fib(n - 2);
}

fn main() -> i32 {
    var i = 0;
    var sum = 0;
    while i < 10 {
        i += 1;
        sum += fib(i);
    }
    if sum != 88 { return 1; }
    return 0;
}
```

```bash
zr fib.zr -o fib && ./fib && echo "ok"
```

`for i in 0..10` 现在还不行，换成 `while` 即可。

## 下一步

- 装好编译器 → [安装与第一个程序](/learn/getting-started/)
- 想知道现在到底能写什么 → 本页的[实现状态](#实现状态)
- 想看完整的开发进度 → [项目进展](/community/roadmap/)
- 想参与实现 → [贡献指南](/community/contributing/)