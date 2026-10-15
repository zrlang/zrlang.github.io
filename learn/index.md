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

> **请先读这一段。** zr 编译器目前处于 **v0.5.0 早期原型**阶段。
> 它的**前端设计已经完整**（标准库 3900 行全部用 zr 写，覆盖 11 个目标平台），
> 但**代码生成还差很远**：仓库的 `tests/README.md` 明确写着，按 Rust Book
> 顺序组织的测试用例目前只覆盖了 8 个，循环、递归、借用、枚举、`match`、
> 泛型、闭包、线程等章节「一个都测不了」。
>
> 所以本教程的定位是：**这是语言的设计说明，不是当前可用功能的清单。**
> 每章顶部都标注了真实状态，标注为「尚未实现」的章节不要指望代码能跑。

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
| [安装与第一个程序](/learn/getting-started/) | 构建编译器、交叉编译 | ● 已通过测试 |
| [1. 基础语法](/learn/01-syntax/) | 变量、标量、函数、`if`/`else` | ◐ 部分可用 |
| [2. 所有权系统](/learn/02-ownership/) | 所有权、借用、切片 | ○ 尚未实现 |
| [3. 结构体与枚举](/learn/03-structs-enums/) | `struct`、`impl`、`enum`、`Option` | ○ 尚未实现 |
| [4. 包管理与项目](/learn/04-project/) | 编译模型、模块、`zr pkg` 规划 | ◐ 部分可用 |
| [5. 集合类型](/learn/05-collections/) | `Vec<T>`、`String` | ○ 尚未实现 |
| [6. 错误处理](/learn/06-errors/) | `panic`、`Result`、`?` | ○ 尚未实现 |
| [7. 泛型、Trait 与生命周期](/learn/07-generics/) | 泛型、trait、生命周期 | ○ 尚未实现 |
| [8. 自动化测试](/learn/08-testing/) | 断言、用例、运行器 | ◐ 部分可用 |
| [9. 函数式编程特性](/learn/09-functional/) | 闭包、迭代器、适配器 | ○ 尚未实现 |
| [10. 智能指针](/learn/10-pointers/) | `Box`、堆分配 | ○ 尚未实现 |
| [11. 并发编程](/learn/11-concurrency/) | 协程、`async`、通道 | ○ 尚未实现 |
| [12. 面向对象特性](/learn/12-oop/) | 封装、trait 对象、状态模式 | ○ 尚未实现 |
| [13. 模式匹配](/learn/13-patterns/) | `match`、`if let`、解构 | ○ 尚未实现 |
| [14. 高级特性](/learn/14-advanced/) | `unsafe`、宏、`comptime`、FFI | ○ 尚未实现 |

● 已通过测试　◐ 部分可用　○ 尚未实现

### 已经能跑的部分

`tests/cases/` 里目前通过的全部内容：

| 用例 | 内容 |
|:-----|:-----|
| `01_variables.zr` | 变量与可变性：`let` / `mut` / shadowing |
| `02_scalars.zr` | 数据类型：整数标量与 `+ - * / %` |
| `03_precedence.zr` | 运算符：优先级、括号、结合性 |
| `04_comparisons.zr` | 运算符：`== != > >=` |
| `05_logic.zr` | 运算符：布尔字面量、`!` `\|\|` |
| `06_functions.zr` | 函数：定义、参数、返回值、嵌套调用 |
| `07_control_flow.zr` | 控制流：`if` / `else`、分支早返回 |
| `08_three_args.zr` | 函数：三参数调用（寄存器分配） |

也就是说：**变量、算术、函数调用、早返回**。循环都还不工作
（MIR → SSA 缺 φ 节点，回边读到旧值导致不终止）。

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

## 三分钟版本

```rust
use io::{println, println_int};

fn main() -> i32 {
    let mut total = 0;
    let mut i = 1;
    while i <= 100 {
        if i % 15 == 0 { println("FizzBuzz"); }
        else if i % 3 == 0 { println("Fizz"); }
        else if i % 5 == 0 { println("Buzz"); }
        else { println_int(i); }
        i += 1;
    }
    return total;
}
```

这段代码**现在编译不过**（`while` 依赖尚未实现的 φ 节点），
但它是这门语言最终的样子。

## 和 Rust 的关键差异

| 方面 | Rust | zr |
|:-----|:-----|:----|
| 可变绑定 | `let mut` | `let mut`（README 写的 `var` 尚未实现） |
| 尾表达式返回 | 支持 | 必须显式 `return` |
| 并发模型 | 线程 + `Future` | **只有协程**，没有线程 |
| 包管理 | Cargo + crates.io | 无（`zr pkg` 排在 v0.7.0） |
| 哈希表 | `HashMap` | 无，用 `Vec<(K, V)>` |
| 内部可变性 | `Rc<RefCell<T>>` | 无 |
| 标准库 | 编译进 `rustc` | **用 zr 自己写**，按需加载 |
| 后端 | LLVM（默认） | **自研**，不依赖 LLVM |
| 隐式转换 | 有限（`From`/`Into`） | 只有显式 `as` |

## 下一步

- 装好编译器 → [安装与第一个程序](/learn/getting-started/)
- 想知道下一步做什么 → [路线图](/community/roadmap/)
- 想参与实现 → [贡献指南](/community/contributing/)