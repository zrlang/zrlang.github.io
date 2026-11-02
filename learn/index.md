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

> **请先读这一段。** zr 编译器正在快速推进。**v0.5.0–v0.9.0 里程碑已经全部完成**，
> 语言测试用例从最早的 8 个增加到 **125 个**：变量、标量、浮点、函数、递归、
> 全部循环（含 `for`）、`if`/`else` 作为表达式、`match` 全模式（结构体/元组/范围/
> 枚举/`if let`/`while let`/`let` 解构）、`comptime`、`as` 转换、指针与 `.rodata`
> 字符串、结构体与枚举、`union`、`impl` 方法与 `Drop`、函数指针、泛型/trait/关联类型、
> `impl Trait`、`const` 泛型、闭包、`async`/`await`/`spawn`/`yield`、`Vec`/`String`/切片、
> `Result` 与 `?`、`#[derive]`、宏、线程与文件系统都能编译并正确运行
> （在 `-O0` 到 `-Oz` 各验证一遍）。
>
> 还没动的大块：**`Box`/`Rc`/`RefCell` 智能指针、`HashMap`/`HashSet`、trait 对象
> （`dyn`）的 vtable 分派、`panic!` 宏、迭代器组合子、完整借用检查、生命周期检查、
> proc-macro**。
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
| [1. 基础语法](/learn/01-syntax/) | 变量、标量与浮点、函数、递归、循环（含 `for`） | ● 已通过测试 |
| [2. 所有权系统](/learn/02-ownership/) | 所有权、借用、切片 | ◐ 最小移动 + 借用切片；生命周期未检查 |
| [3. 结构体与枚举](/learn/03-structs-enums/) | `struct`、`impl`、`enum`、`Option`、`union` | ● 已通过测试 |
| [4. 包管理与项目](/learn/04-project/) | `zr pkg` / `fmt` / `lsp`、增量编译 | ◐ 路径依赖 |
| [5. 集合类型](/learn/05-collections/) | `Vec<T>`、`String` | ◐ 无 `HashMap` |
| [6. 错误处理](/learn/06-errors/) | `panic`、`Result`、`?` | ● 已通过测试（无 `panic!` 宏） |
| [7. 泛型、Trait 与生命周期](/learn/07-generics/) | 泛型、trait、生命周期 | ◐ 无 trait 对象 |
| [8. 自动化测试](/learn/08-testing/) | 断言、125 个用例、跨优化等级运行器 | ● 已通过测试 |
| [9. 函数式编程特性](/learn/09-functional/) | 闭包、迭代器、适配器 | ● 已通过测试（无迭代器） |
| [10. 智能指针](/learn/10-pointers/) | 指针、内存模型、栈槽 | ◐ 无 `Box`/`Rc` |
| [11. 并发编程](/learn/11-concurrency/) | 协程、`async`、通道、线程 | ◐ 无通道/Mutex |
| [12. 面向对象特性](/learn/12-oop/) | 封装、trait 对象、状态模式 | ◐ 无 trait 对象 |
| [13. 模式匹配](/learn/13-patterns/) | `match` 全模式、解构、`if let`/`while let` | ● 已通过测试 |
| [14. 高级特性](/learn/14-advanced/) | `comptime`、属性、FFI、宏、跨平台 | ◐ `unsafe` 无语义、无 proc-macro |

● 已通过测试　◐ 部分可用　○ 尚未实现

### 已经能跑的部分

`tests/cases/` 下 125 个用例覆盖的内容：

| 领域 | 用例 |
|:-----|:-----|
| 变量与标量 | `01_variables`、`02_scalars`、`03_precedence`、`04_comparisons`、`05_logic`、`13_casts`、`21_literal_suffixes` |
| 函数 | `06_functions`、`08_three_args`、`22_call_preserve` |
| 控制流 | `07_control_flow`、`09_while`、`10_if_expression`、`11_if_else_chain`、`15_loops`、`17_loop_break`、`44_for_range`、`45_for_array`、`61_labeled_loops`、`97_loop_value` |
| 编译期求值 | `12_comptime`、`16_comptime_fn`、`26_comptime_struct` |
| 浮点 | `19_float`、`20_f32`、`53_narrow_float` |
| 寄存器溢出 | `14_spill`、`18_spill_ops` |
| 字符串与指针 | `23_strings`、`24_pointers`、`65_slices` |
| 模式匹配 | `25_match`、`52_if_let`、`54_struct_pattern`、`55_tuple_pattern`、`56_range_pattern`、`57_enum`、`62_while_let`、`63_let_else`、`121_let_destructure` |
| 结构体、枚举、`union` | `33_methods`、`34_tuple_struct`、`35_struct_update`、`37_struct_array`、`57_enum`、`114_enum_ord_derive`、`116_enum_default`、`117_union` |
| `Drop` 与移动 | `30_drop`、`36_drop_array`、`38_drop_temp`、`39_partial_move`、`40_drop_temp_nested`、`41_return_drop_array`、`42_temp_partial_move`、`43_return_drop_struct`、`46_dynamic_index_move`、`87_move_check` |
| 异步与协程 | `29_async`、`47_async_return_aggregate`、`48_async_nested_aggregate`、`49_dynamic_future_source`、`50_dynamic_future_aggregate`、`51_spawn`、`123_yield_cooperative` |
| 函数指针与闭包 | `31_fn_ptr`、`32_fn_ptr_async`、`73_closures`、`83_closure_fnptr`、`84_closure_capture_value`、`109_closure_env_cross_fn`、`110_closure_env_generic_passthrough`、`125_closure_to_fn` |
| 泛型 / trait / 关联类型 | `66_generics`、`74_generic_alias`、`91_multi_bound_generics`、`98_generic_infer_usage`、`118_assoc_projection`、`119_qualified_assoc`、`120_apit`、`122_const_generic`、`124_trait_default_methods` |
| `#[derive]` | `71_derive`、`78_derive_methods`、`94_array_field_hash`、`96_str_slice_hash`、`100_debug_derive`、`108_debug_pretty`、`112_fmt_debug` |
| 错误处理 | `69_question`、`89_prelude_variant` |
| 模块与导入 | `70_type_alias`、`75_use_alias`、`90_glob_import`、`103_inline_mod` |
| 宏、线程、进程、文件系统 | `58_macros`、`59_threads`、`60_process`、`64_fs_path`、`99_fs_tempfile_metadata` |
| 内联汇编、数组、SIMD | `27_inline_asm`、`28_arrays` |
| 借用与边界 | `86_bounds_check`、`105_borrow_nll`、`107_string_push_bytes_reserve` |

也就是说：**变量、算术、浮点、函数调用、递归、循环（含 `for`）、`if`/`else`
表达式、`match` 全模式、`comptime`、`as` 转换、指针与字符串字面量、结构体与
枚举、`union`、`impl` 方法与 `Drop`、函数指针、泛型/trait/关联类型、闭包、
`async`/`await`/`spawn`/`yield`、`Vec`/`String`/切片、`Result` 与 `?`、`#[derive]`、
宏、线程与文件系统**。

还不能用：`Box`/`Rc`/`RefCell`、`HashMap`/`HashSet`、trait 对象（`dyn`）的
vtable 分派、`panic!` 宏、迭代器组合子、完整借用检查、生命周期检查、proc-macro。

跑一遍：

```bash
cargo test --test zr_language    # 125 用例 × 5 等级 = 625 项
cargo test --test zr_negative    # 37 个负向用例
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
| 可变绑定 | `let mut` | `let mut` |
| 尾表达式返回 | 支持 | 必须显式 `return` |
| 并发模型 | 线程 + `Future` | 协程 + `async`/`await` + `spawn`（线程已有，无 `Mutex`/`Send`） |
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
    let mut i = 0;
    let mut sum = 0;
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

`for i in 0..10` 现在也可以用了（`44_for_range.zr`），上面为直观用了 `while`。

## 下一步

- 装好编译器 → [安装与第一个程序](/learn/getting-started/)
- 想知道现在到底能写什么 → 本页的[实现状态](#实现状态)
- 想看完整的开发进度 → [项目进展](/community/roadmap/)
- 想参与实现 → [贡献指南](/community/contributing/)