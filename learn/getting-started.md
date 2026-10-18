---
title: 安装与第一个程序
description: 用 git clone 和 cargo build 拿到 zr 编译器，然后编译、运行第一个程序。
sidebar: learn
status: ready
status_note: 构建编译器与交叉编译链路可用。
prev: null
next:
  title: 1. 基础语法
  url: /learn/01-syntax/
---

## zr 的 CLI 长什么样

编译是**单文件**的，另外有四个子命令：

```
zr [OPTIONS] <INPUT.zr>        # 编译
zr lsp                         # 语言服务器（stdio）
zr pkg <SUBCOMMAND> ...        # 包管理器
zr fmt [--check] <FILE>        # 格式化源码
zr clean                       # 清空增量编译缓存
```

```
zr 0.5.0 — zr language compiler

USAGE:
    zr [OPTIONS] <INPUT.zr>

OPTIONS:
    -o <file>           Output file
    -O0..-O3, -Oz       Optimization level
    -c                  Compile only, do not link
    --target <triple>   Target triple (default: host)
    --wat               Emit WebAssembly text (wasm32 only)
    --dump-tokens      Dump lexer output
    --dump-ast          Dump AST
    --dump-hir          Dump HIR
    --dump-mir          Dump MIR
    --dump-ssa          Dump SSA
    --dump-ssa-after    Dump SSA after optimization
    --dump-asm          Dump assembly
    --emit-llvm         Emit LLVM IR (future)
    -h, --help          Show this help
    -V, --version       Print version
```

另外还有三个未出现在 `--help` 里但可用的选项：`-g` / `--debug`（DWARF 调试信息）、
`--no-incremental`（关闭增量编译，默认是**开启**的）、`-v` / `--verbose`。

**仍然没有** `zr build`、`zr run`、`zr test`、`zr check`、`zr doc`、`zr link`。
把 `build` 当参数传进去会得到 `multiple input files not supported yet`。

详见[命令行参考](/tools/cli/)。

`--version` 的输出：

```
zr 0.5.0
host: x86_64-apple-darwin (Mach-O)
targets: arm-none-eabi, riscv32-unknown-none, riscv64-unknown-none,
         x86_64-unknown-linux-gnu, aarch64-unknown-linux-gnu,
         x86_64-apple-darwin, aarch64-apple-darwin,
         x86_64-pc-windows-msvc, aarch64-pc-windows-msvc,
         wasm32-unknown-unknown, wasm32-wasi
```

## 环境要求

| 项目 | 要求 |
|:-----|:-----|
| 构建 zr 编译器 | Rust 工具链 ≥ 1.70 |
| 宿主平台 | Linux / macOS / Windows，x86-64 或 aarch64 |
| 交叉编译 | 对应目标的 C 工具链（`clang` / `as` / `lld-link` / `mingw`） |
| 嵌入式目标 | 裸机工具链（`arm-none-eabi-gcc`、`riscv64-unknown-elf-gcc`，或支持这些目标的 clang） |

编译器本身**不依赖运行时库**：只有编译用户程序时才会按目标链接对应的
`libzrrt-<平台>.a`。缺少交叉工具链时该目标会被安静跳过。

## 构建编译器

```bash
git clone https://github.com/zrlang/zr.git
cd zr
cargo build --release
```

产物位于 `./target/release/zr`。放进 `PATH`：

```bash
# Linux / macOS
export PATH="$PWD/target/release:$PATH"

# Windows PowerShell
$env:PATH = "$PWD\target\release;$env:PATH"
```

验证：

```bash
zr --version
```

## 第一个程序

`println` 来自标准库，而标准库目前还有模块编不过，所以先写一个不依赖 `use`
的版本。它**现在就能编译并运行**：

```rust
// hello.zr
extern "C" {
    fn zr_write(fd: i32, s: *const u8, n: usize);
}

fn main() -> i32 {
    zr_write(1, "Hello, zr!\n" as *const u8, 12);
    return 0;
}
```

```bash
zr hello.zr -o hello
./hello
# Hello, zr!
```

带标准库的版本是这样写的（`use io::println`），但在标准库修好之前可能编不过：

```rust
use io::println;

fn main() -> i32 {
    println("Hello, zr!");
    return 0;
}
```

标准库是**按需加载**的：`use io::println` 会让编译器去 `std/io.zr`
找 `io` 模块并把它并进当前编译单元。所以第一次运行前请确认 `std/` 目录
与 `zr` 可执行文件在同一份仓库里。

> **⚠️ 现状**：`std/` 里目前还有模块编译不过，因此带 `use` 的程序暂时可能失败。
> 用标准库之前，先确认它能编过；不依赖标准库的程序（不写 `use`）是安全的。
> 完整清单见[教程概览](/learn/)的实现状态。

## `main` 的约定

`main` 返回 `i32`，作为进程退出码：

```rust
fn main() -> i32 {
    if failed() {
        return 1;             // 非零退出码
    }
    return 0;
}
```

不同目标的启动方式略有差别，但都符合平台惯例：

| 目标 | `_start` 的行为 |
|:-----|:----------------|
| Linux | 直接用系统调用退出进程（不依赖 C 运行时） |
| macOS | 调用运行时的 `zr_exit`，转发到 libc |
| Windows | 调用运行时的 `zr_exit`，转发到 `ExitProcess` |
| 裸机 ARM / RISC-V | 调用 `main` 后停在自循环（没有「退出进程」的概念） |

## 常用的编译命令

```bash
# 编译并链接（这就是全部，没有 build 子命令）
zr app.zr -o app

# 优化级别
zr app.zr -O0 -o app      # 不优化，编译最快
zr app.zr -O2 -o app      # 默认推荐
zr app.zr -O3 -o app      # 更激进的内联与循环变换
zr app.zr -Oz -o app      # 针对体积

# 只编译不链接，产出目标文件
zr lib.zr -c -o lib.o

# 链接多个目标文件、C 库与 zr 运行时
zr main.zr -c -o main.o
zr lib.zr  -c -o lib.o
cc main.o lib.o -lc -lm target/release/build/zr-*/out/libzrrt-macos_x86_64.a -o app

# 只做语法/类型检查，不产出文件
zr check.zr -c -o /dev/null
```

## 交叉编译

目标三元组与 Cargo 的 `--target` 同名：

```bash
zr app.zr --target aarch64-unknown-linux-gnu -o app-arm64
zr app.zr --target aarch64-apple-darwin       -o app-macos-arm64
zr app.zr --target x86_64-pc-windows-msvc     -o app.exe
zr app.zr --target wasm32-unknown-unknown     -o app.wasm
zr app.zr --target wasm32-unknown-unknown --wat -o app.wat   # 人类可读的 wasm
zr app.zr --target arm-none-eabi              -o app.elf     # 可直接烧录的固件
```

裸机目标直接产出可烧录的 ELF 映像，**不需要链接器**。
完整的 11 个目标矩阵见[支持的目标平台](/tools/targets/)。

## 看一眼编译过程

调试时可以把任意中间表示打出来：

```bash
zr program.zr --dump-tokens    # ① 词法分析结果
zr program.zr --dump-ast       # ② AST
zr program.zr --dump-hir       # ③ HIR（类型已推导、所有权已标注）
zr program.zr --dump-mir       # ④ MIR（基本块与终结器，控制流已脱糖）
zr program.zr --dump-ssa       # ⑤ SSA（φ 节点已插入、寄存器重命名完成）
zr program.zr --dump-ssa-after # ⑥ 优化后的 SSA
zr program.zr --dump-asm       # ⑦ 最终机器码
```

这也是学 zr 最好的方式：想知道 `match` 脱糖成什么样、`comptime` 在哪一步
被求值，`dump` 一下就知道了。见[编译器架构](/tools/architecture/)。

## 跑语言测试

zr 的测试是自检式 `.zr` 程序（`tests/cases/*.zr`，共 25 个），由宿主侧运行器驱动。
每个用例会在 `-O0` / `-O1` / `-O2` / `-O3` / `-Oz` 下**各编译运行一遍** ——
优化 pass 只要有一条改坏语义，用例就会在某个等级上变红。

```bash
# 跑全部语言用例
cargo test --test zr_language

# 单独编译并运行一个用例
zr tests/cases/15_loops.zr -o /tmp/t1 && /tmp/t1

# 编译器自身的 Rust 单元测试
cargo test
```

详见 [8. 自动化测试](/learn/08-testing/)。

## 下一步

- [1. 基础语法](/learn/01-syntax/) —— 变量、函数、控制流
- [4. 包管理与项目](/learn/04-project/) —— zr 的编译模型与模块系统
- [命令行参考](/tools/cli/) —— 全部选项