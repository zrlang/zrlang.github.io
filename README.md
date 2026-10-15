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
zr build hello.zr -o hello
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

```
zr <COMMAND> [OPTIONS] <INPUT>

COMMANDS:
  build <FILE>     编译并链接为可执行文件（默认）
  check <FILE>     仅类型检查，不生成代码
  run <FILE>       编译并立即运行
  test [NAME]      运行测试
  fmt / doc        格式化 / 生成文档（规划中）

OPTIONS:
  -o, --output <FILE>     输出文件名
  -O0..-O3, -Oz           优化级别
  -c                      只编译不链接
  --target <TRIPLE>       目标三元组
  --wat                   输出 WebAssembly 文本
  --dump-ast / --dump-hir / --dump-mir / --dump-ssa / --dump-asm
```

详见 [命令行参考](https://zrlang.github.io/tools/cli/)。


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

- **v0.5.0（当前）** — 完整的编译流水线：词法 → 解析 → HIR → MIR → SSA → 优化 → 代码生成，
  覆盖 11 个目标平台；标准库 core / io / string / collections / async / error / net / simd。
- **v0.6.0** — 真实指令选择、线性扫描寄存器分配、优化 pass 完整实现、`comptime` 求值。
- **v0.7.0** — 增量编译、包管理器 `zr pkg`、格式化器 `zr fmt`、语言服务器（LSP）。
- **v1.0.0** — API 稳定、完整异步运行时、自举（用 zr 重写编译器）。

详见 [路线图](https://zrlang.github.io/community/roadmap/)。


## 继续阅读

| 我想…… | 去这里 |
|:-------|:-------|
| 从零开始写第一个程序 | [安装与第一个程序](https://zrlang.github.io/learn/getting-started/) |
| 快速浏览全部语法 | [语法速览](https://zrlang.github.io/learn/syntax/) |
| 理解所有权与借用规则 | [所有权与借用](https://zrlang.github.io/learn/ownership/) |
| 了解类型系统与 trait 求解 | [类型与 trait](https://zrlang.github.io/learn/types/) |
| 写并发 / 网络程序 | [异步与协程](https://zrlang.github.io/learn/async/) |
| 做编译期元编程 | [comptime 编译期求值](https://zrlang.github.io/learn/comptime/) |
| 给嵌入式设备编译固件 | [嵌入式与交叉编译](https://zrlang.github.io/learn/embedded/) |
| 读懂编译器源码 | [编译器架构](https://zrlang.github.io/tools/architecture/) |
| 浏览标准库 | [标准库](https://zrlang.github.io/std/) |
| 参与开发 | [贡献指南](https://zrlang.github.io/community/contributing/) |


## 示例程序

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