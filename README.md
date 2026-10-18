---
layout: home
permalink: /
---
<!-- hero -->
<div align="center">

<h1><span class="hero-wordmark">zr</span></h1>

<p><strong>融合 Rust 的内存安全、Zig 的显式控制与 Python 的表达力</strong><br>
<strong>一门为系统编程而生的现代编程语言。</strong></p>

<p>
<a href="https://github.com/zrlang/zr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-c2410c.svg" alt="MIT License" height="20"></a>
<a href="https://github.com/zrlang/zr/releases"><img src="https://img.shields.io/badge/version-0.5.0-c2410c.svg" alt="version 0.5.0" height="20"></a>
<a href="https://github.com/zrlang/zr/actions"><img src="https://img.shields.io/badge/build-passing-4c9a56.svg" alt="build passing" height="20"></a>
<a href="https://zrlang.github.io/tools/targets/"><img src="https://img.shields.io/badge/targets-11%20platforms-c2410c.svg" alt="11 platforms" height="20"></a>
</p>

</div>

<!-- docs -->

## 先读这一段：项目状态

zr 正在快速推进。**v0.6.0 里程碑已经全部完成**，语言测试用例从最早的 8 个
增加到 **25 个**：

```bash
# 现在就能编译并运行
fn fib(n: i32) -> i32 {
    if n <= 1 { return n; }
    return fib(n - 1) + fib(n - 2);
}

fn main() -> i32 {
    var i = 0;
    var sum = 0;
    while i < 10 { i += 1; sum += fib(i); }
    return 0;
}
```

已跑通的领域：**变量、标量与浮点、函数与递归、全部循环、`if`/`else` 作为表达式、
`match` 字面量匹配、`comptime` 编译期求值、`as` 转换、指针与 `.rodata` 字符串、寄存器溢出**。
每个用例都会在 `-O0` 到 `-Oz` 各编译运行一遍，防止优化改坏语义。

还没动的语言层面：**所有权与借用、结构体字段与枚举、切片、`Vec`/`String`、
`Result`、泛型/trait、闭包、线程**。`for` 也还不能用（区间表达式解析问题）。

[教程](/learn/)的 14 章按 Rust Book 顺序写全了**语言设计**，每章顶部标注真实状态。
完整进展见[项目进展](https://zrlang.github.io/community/roadmap/)。

## zr 是什么

zr 是一门**静态类型、编译型、系统级**编程语言。它不打算在所有维度上都做妥协：

| 维度 | zr 的选择 |
|:-----|:----------|
| 内存安全 | 所有权 + 借用 + 生命周期，在编译期证明，绝不依赖 GC |
| 控制力 | 显式内存布局、`unsafe` 边界、可直接写裸指针与系统调用 |
| 表达力 | 类型推导、模式匹配、代数数据类型、闭包与高阶函数 |
| 可读性 | 缩进无关、统一语法、最小标点，读起来像散文 |
| 并发 | 协程是一等公民，`async`/`await` 与通道是语言原语 |
| 元编程 | `comptime` 编译期求值与类型反射 |
| 互操作 | C ABI 兼容，`extern "C"` 声明即可链接任意 C 库 |
| 运行时 | 可选的最小运行时，抽象全部在编译期消除 |

```rust
// hello.zr —— 你的第一个 zr 程序
use io::println;

fn main() -> i32 {
    println("Hello, zr!");
    return 0;
}
```

```bash
zr hello.zr -o hello
$ ./hello
Hello, zr!
```

> 想深入了解设计取舍，请阅读 [编译器架构](https://zrlang.github.io/tools/architecture/)；
> 想直接上手，请前往 [安装与第一个程序](https://zrlang.github.io/learn/getting-started/)。


## 核心特性

### 内存安全，不需要垃圾回收

zr 采用**所有权（Ownership）+ 借用（Borrowing）+ 生命周期（Lifetimes）**三重机制，
在编译期证明内存安全，运行时开销为零：

```rust
// 所有权转移（move）
fn take(s: String) { /* s 在这里被消费 */ }

let s = String::from_bytes("zr");
take(s);
// println(s);          // ❌ 编译错误：s 已失效

// 借用：同一时刻要么多个不可变借用，要么一个可变借用
fn borrow(s: &String) -> usize { return s.len(); }
fn append(s: &mut String, c: u8) { s.push_byte(c); }

let len = borrow(&s);
append(&mut s, b'!');
```

### 代数数据类型与模式匹配

```rust
pub enum Expr {
    Num(f64),
    Add(Box<Expr>, Box<Expr>),
    Var(String),
}

fn eval(e: &Expr) -> f64 {
    match e {
        Expr::Num(n)           => *n,
        Expr::Add(l, r)        => eval(l) + eval(r),
        Expr::Var(name)        => panic("unbound variable"),
    }
}

// 模式匹配支持字面量、范围、或模式、解构、守卫与通配符
match status {
    200          => "OK",
    400..=499    => "Client Error",
    500..=599    => "Server Error",
    _            => "Unknown",
}
```

### 泛型、trait 与关联类型

```rust
pub trait Mappable {
    type Item;
    type Output;
    fn map<F>(self, f: F) -> Self::Output
    where F: Fn(Self::Item) -> Self::Output;
}

fn largest<T: Ord + Copy>(slice: []const T) -> T {
    let mut m = slice[0];
    for item in slice[1..] {
        if item > m { m = item; }
    }
    m
}
```

### 一等公民协程与 async/await

协程不是库胶水，而是语言原语 —— 由编译器负责栈布局与切换：

```rust
async fn echo(conn: &mut Connection) -> Result<(), IoError> {
    let mut buf = [0u8; 1024];
    loop {
        let n = await conn.read(&mut buf);
        if n == 0 { break; }
        await conn.write(&buf[0..n]);
    }
    Result::Ok(())
}

// 并发地等待多个 Future，谁先就绪就用谁
async fn fastest(a: Future<String>, b: Future<String>) -> String {
    return await race(a, b);
}
```

### 编译期求值（`comptime`）

```rust
/// 编译期计算阶乘
comptime fn fact(n: i32) -> i32 {
    if n <= 1 { 1 } else { n * fact(n - 1) }
}

const SIZE: usize = fact(5);   // 编译期求值为 120

/// 编译期反射：根据类型信息生成代码
fn make_default<T>() -> T {
    comptime match @typeInfo(T) {
        .Struct  => T::default(),
        .Int     => 0 as T,
        .Pointer => null,
        else     => unreachable(),
    }
}
```

### 显式错误处理

错误是值，不是异常；传播是运算符，不是控制流：

```rust
fn read_config(path: &str) -> Result<Config, IoError> {
    let file = File::open(path)?;     // 出错即返回 Err
    let text = file.read_to_string()?;
    parse_config(text)
}
```

### C ABI 兼容

```rust
extern "C" {
    fn printf(fmt: *const u8, ...) -> i32;
    fn strlen(s: *const u8) -> usize;
}

fn main() -> i32 {
    printf("hello from C!\n" as *const u8);
    return 0;
}
```


## 一套前端，十一个目标

zr 编译器自带代码生成后端，不依赖 LLVM，因此交叉编译只需要目标平台的 C 工具链
（甚至连链接器都不需要）：

| 目标 | 容器格式 | 运行时 |
|:-----|:---------|:-------|
| `x86_64` / `aarch64` Linux | ELF | 裸系统调用 |
| `x86_64` / `aarch64` macOS | Mach-O | libSystem |
| `x86_64` / `aarch64` Windows | PE/COFF | kernel32 |
| `wasm32-unknown-unknown` / `wasm32-wasi` | wasm | 模块导入 |
| `arm-none-eabi` | ELF32 裸机映像 | semihosting |
| `riscv32` / `riscv64-unknown-none` | ELF32/64 裸机映像 | semihosting |

```bash
zr app.zr --target aarch64-apple-darwin -o app-arm64
zr app.zr --target wasm32-unknown-unknown --wat -o app.wat
zr app.zr --target arm-none-eabi -o app.elf      # 直接产出可烧录映像
```

完整矩阵见 [支持的目标平台](https://zrlang.github.io/tools/targets/)。


## 工具链

编译是**单文件**的，另外有四个子命令：

```
zr [OPTIONS] <INPUT.zr>        # 编译
zr lsp                         # 语言服务器（stdio）
zr pkg <SUBCOMMAND> ...        # 包管理器
zr fmt [--check] <FILE>        # 格式化源码
zr clean                       # 清空增量编译缓存

OPTIONS:
    -o <file>           Output file
    -O0..-O3, -Oz       Optimization level
    -c                  Compile only, do not link
    --target <triple>   Target triple (default: host)
    --wat               Emit WebAssembly text (wasm32 only)
    --no-incremental    Disable incremental compilation (on by default)
    --dump-tokens / --dump-ast / --dump-hir
    --dump-mir / --dump-ssa / --dump-ssa-after / --dump-asm
```

```bash
zr app.zr -o app                                    # 编译并链接（增量编译默认开启）
zr app.zr -c -o /dev/null                           # 只检查不产出
zr app.zr --target wasm32-unknown-unknown --wat -o app.wat
zr app.zr --target arm-none-eabi -o app.elf
zr pkg init && zr pkg add lib ../lib                # 路径依赖
```

还没有 `zr build` / `check` / `run` / `test` / `doc` / `link`。
完整选项见[命令行参考](https://zrlang.github.io/tools/cli/)。

## 与同类语言的对比

| 特性 | zr | Rust | Zig | Go | Python |
|:-----|:---|:-----|:----|:--|:-------|
| 内存安全 | ✅ 所有权 | ✅ 所有权 | ⚠️ 手动 | ✅ GC | ✅ GC |
| 无 GC | ✅ | ✅ | ✅ | ❌ | ❌ |
| C 互操作 | ✅ | ✅ | ✅ | ⚠️ cgo | ⚠️ ctypes |
| 协程 | ✅ 一等公民 | ⚠️ 宏 / async | ❌ | ✅ | ⚠️ |
| 泛型 | ✅ trait | ✅ trait | ⚠️ comptime | ❌ | 鸭子类型 |
| 编译期求值 | ✅ comptime | ⚠️ const fn | ✅ | ❌ | ❌ |
| 错误模型 | ✅ Result | ✅ Result | ✅ ErrorUnion | ❌ panic | ❌ 异常 |
| 学习曲线 | 中 | 陡 | 中 | 平缓 | 平缓 |


## 路线图

- **v0.5.0 ✅** — 完整编译流水线：词法 → 解析 → HIR → MIR → SSA → 优化 → 代码生成，
  覆盖 11 个目标平台；标准库 core / io / string / collections / async / error / net / simd。
- **v0.6.0 ✅** — `comptime` 编译期求值、完整属性系统、**迭代支配边界插 φ**（解开循环的关键）、
  活跃性分析与栈溢出、x86-64/AArch64 的 f32 与 f64 指令选择、优化 pass 完整化、编译确定性。
- **v0.7.0 🚧** — AArch64 浮点、字符串字面量落 `.rodata`、`extern "C"` 接通运行时、
  指针与最小 SSA 内存模型已落地；ARM32/RISC-V/wasm 的浮点与指针后端、`str` 的切片表示、
  32 位目标的多字长算术仍在做。
- **v0.8.0 📋** — `zr pkg` 注册表与联网、`zr fmt` 风格定稿、LSP 补全与跳转、
  内联汇编、SIMD 指令选择。
- **v1.0.0 🎯** — API 稳定、完整异步运行时、**自举**（用 zr 重写编译器）、性能接近 Rust。

每项的完整清单与已知边界见[项目进展](https://zrlang.github.io/community/roadmap/)。

## 继续阅读

[教程](https://zrlang.github.io/learn/)按《Rust 程序设计语言》的章节顺序组织，共 14 章，
每章顶部标注了当前编译器的实现状态。

| 章 | 内容 | 状态 |
|:---|:-----|:-----|
| [安装与第一个程序](https://zrlang.github.io/learn/getting-started/) | 构建编译器、交叉编译 | ● 已通过测试 |
| [1. 基础语法](https://zrlang.github.io/learn/01-syntax/) | 变量、类型、函数、循环 | ◐ 仅缺 `for` |
| [2. 所有权系统](https://zrlang.github.io/learn/02-ownership/) | 所有权、借用、切片 | ○ 尚未实现 |
| [3. 结构体与枚举](https://zrlang.github.io/learn/03-structs-enums/) | `struct`、`impl`、`enum`、`Option` | ○ 尚未实现 |
| [4. 包管理与项目](https://zrlang.github.io/learn/04-project/) | `zr pkg` / `fmt` / `lsp`、增量编译 | ◐ 路径依赖 |
| [5. 集合类型](https://zrlang.github.io/learn/05-collections/) | `Vec<T>`、`String` | ○ 尚未实现 |
| [6. 错误处理](https://zrlang.github.io/learn/06-errors/) | `panic`、`Result`、`?` | ○ 尚未实现 |
| [7. 泛型、Trait 与生命周期](https://zrlang.github.io/learn/07-generics/) | 泛型、trait、生命周期 | ○ 尚未实现 |
| [8. 自动化测试](https://zrlang.github.io/learn/08-testing/) | 断言、25 个用例、跨优化等级运行器 | ◐ 无 `zr test` |
| [9. 函数式编程特性](https://zrlang.github.io/learn/09-functional/) | 闭包、迭代器、适配器 | ○ 尚未实现 |
| [10. 智能指针](https://zrlang.github.io/learn/10-pointers/) | 指针、内存模型、栈槽 | ◐ 无 `Box`/`Rc` |
| [11. 并发编程](https://zrlang.github.io/learn/11-concurrency/) | 协程、`async`、通道 | ○ 尚未实现 |
| [12. 面向对象特性](https://zrlang.github.io/learn/12-oop/) | 封装、trait 对象、状态模式 | ○ 尚未实现 |
| [13. 模式匹配](https://zrlang.github.io/learn/13-patterns/) | `match` 脱糖、绑定臂、守卫 | ◐ 仅字面量类 |
| [14. 高级特性](https://zrlang.github.io/learn/14-advanced/) | `comptime`、属性、FFI、跨平台 | ◐ 无宏/asm |

● 已通过测试　◐ 部分可用　○ 尚未实现

其他入口：

| 我想…… | 去这里 |
|:-------|:-------|
| 读懂编译器源码 | [编译器架构](https://zrlang.github.io/tools/architecture/) |
| 知道支持哪些平台 | [支持的目标平台](https://zrlang.github.io/tools/targets/) |
| 浏览标准库 | [标准库](https://zrlang.github.io/std/) |
| 看版本发布与设计随笔 | [博客](https://zrlang.github.io/blog/) |
| 参与开发 | [贡献指南](https://zrlang.github.io/community/contributing/) |

## 示例程序

下面三段是这门语言最终的样子，其中**目前只有第 1 段的一部分能编译**
（`while` 依赖尚未实现的 φ 节点）。它们来自 zr 仓库的 `examples/`。

### FizzBuzz

```rust
use io::{println, print_int};

fn main() -> i32 {
    let mut i = 1;
    while i <= 100 {
        if i % 15 == 0 { println("FizzBuzz"); }
        else if i % 3 == 0 { println("Fizz"); }
        else if i % 5 == 0 { println("Buzz"); }
        else { print_int(i); println(""); }
        i += 1;
    }
    return 0;
}
```

### 快速排序

```rust
fn quicksort(slice: []mut i32) {
    if slice.len <= 1 { return; }
    let pivot = slice[slice.len - 1];
    let mut i = 0;
    let mut j = 0;
    while j < slice.len - 1 {
        if slice[j] <= pivot {
            swap(&slice[i], &slice[j]);
            i += 1;
        }
        j += 1;
    }
    swap(&slice[i], &slice[slice.len - 1]);
    quicksort(slice[0..i]);
    quicksort(slice[i + 1..slice.len]);
}
```

### 泛型链表

```rust
pub enum List<T> {
    Nil,
    Cons(T, Box<List<T>>),
}

impl<T> List<T> {
    pub fn push(self, value: T) -> List<T> {
        List::Cons(value, Box::new(self))
    }

    pub fn length(self) -> usize {
        match self {
            List::Nil => 0,
            List::Cons(_, tail) => 1 + tail.length(),
        }
    }
}
```


## 参与社区

- **源码** — [github.com/zrlang/zr](https://github.com/zrlang/zr)
- **讨论** — [GitHub Discussions](https://github.com/zrlang/zr/discussions)
- **问题反馈** — [Issues](https://github.com/zrlang/zr/issues)
- **开发路线** — [路线图](https://zrlang.github.io/community/roadmap/)

贡献流程见 [贡献指南](https://zrlang.github.io/community/contributing/) 或仓库中的 [CONTRIBUTING.md](https://github.com/zrlang/zr/blob/main/CONTRIBUTING.md)。

## 许可证

zr 采用 [MIT](https://github.com/zrlang/zr/blob/main/LICENSE) 许可证发布。

## 致谢

zr 的设计深受以下项目启发：

- **Rust** —— 所有权、借用、trait 与 HIR/MIR 设计
- **Zig** —— 显式控制、C 互操作、`comptime`、自带后端
- **Python** —— 可读性与表达力
- **OCaml / Haskell** —— Hindley-Milner 类型系统
- **Go** —— 协程设计
- **C** —— 贴近硬件的哲学