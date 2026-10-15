---
title: 安装与第一个程序
description: 用一条 git clone 和一条 cargo build 拿到 zr 编译器，然后编译、运行第一个程序。
sidebar: learn
prev:
  title: 学习 zr
  url: /learn/
next:
  title: 语法速览
  url: /learn/syntax/
---

## 环境要求

| 项目 | 要求 |
|:-----|:-----|
| 构建 zr 编译器 | Rust 工具链 ≥ 1.70 |
| 宿主平台 | Linux / macOS / Windows，x86-64 或 aarch64 |
| 交叉编译 | 对应目标的 C 工具链（`clang` / `as` / `lld-link` / `mingw`） |
| 嵌入式目标 | 裸机工具链（`arm-none-eabi-gcc`、`riscv64-unknown-elf-gcc`，或支持这些目标的 clang） |

zr 编译器本身**不依赖运行时库**：只有编译用户程序时才会按目标链接对应的
`libzrrt-<平台>.a`。缺少交叉工具链时该目标会被安静跳过。

## 构建编译器

```bash
git clone https://github.com/zrlang/zr.git
cd zr
cargo build --release
```

产物位于 `./target/release/zr`。把它放进 `PATH`：

```bash
# Linux / macOS
export PATH="$PWD/target/release:$PATH"

# Windows PowerShell
$env:PATH = "$PWD\target\release;$env:PATH"
```

验证：

```bash
zr --version
# zr 0.5.0
```

## 第一个程序

新建 `hello.zr`：

```rust
use io::println;

fn main() -> i32 {
    println("Hello, zr!");
    return 0;
}
```

编译并运行：

```bash
zr build hello.zr -o hello
./hello
# Hello, zr!
```

或者一步到位：

```bash
zr run hello.zr
```

## `main` 的约定

zr 的 `main` 返回 `i32`，作为进程的退出码：

```rust
use io::{println, print_int};

fn main() -> i32 {
    let args_ok = 1;
    if args_ok == 0 {
        return 1;             // 非零退出码
    }
    println("ok");
    return 0;
}
```

不同目标的启动方式略有差别，但都符合平台惯例：

- **Linux** —— `_start` 直接用系统调用退出进程。
- **macOS / Windows** —— `_start` 调用运行时的 `zr_exit`，分别转发到 libc 与 `ExitProcess`。
- **裸机（ARM / RISC-V）** —— `_start` 调用 `main` 之后停在自循环，没有「退出进程」的概念。

## 常用的编译命令

```bash
# 编译并链接为可执行文件
zr build app.zr -o app

# 指定优化级别
zr build app.zr -O2 -o app

# 只编译不链接，产出目标文件
zr build lib.zr -c -o lib.o

# 链接多个目标文件与 C 库
zr build main.zr -c -o main.o
zr build lib.zr  -c -o lib.o
zr link main.o lib.o -lc -lm -o app

# 仅做类型检查，不产出任何文件（最快的反馈循环）
zr check app.zr
```

## 交叉编译

目标三元组与 Cargo 的 `--target` 同名：

```bash
zr app.zr --target aarch64-unknown-linux-gnu -o app-arm64
zr app.zr --target aarch64-apple-darwin       -o app-macos-arm64
zr app.zr --target x86_64-pc-windows-msvc     -o app.exe
zr app.zr --target wasm32-unknown-unknown     -o app.wasm
zr app.zr --target wasm32-unknown-unknown --wat -o app.wat   # 人类可读的 wasm
zr app.zr --target arm-none-eabi              -o app.elf    # 可直接烧录的固件
```

## 看一眼编译过程

调试时可以把任意中间表示打出来：

```bash
zr build program.zr --dump-tokens    # 词法分析结果
zr build program.zr --dump-ast       # 抽象语法树
zr build program.zr --dump-hir       # 高层中间表示
zr build program.zr --dump-mir       # 中级表示（含基本块）
zr build program.zr --dump-ssa       # 静态单赋值形式
zr build program.zr --dump-asm       # 最终机器码
```

## 运行测试套件

仓库自带语言测试：

```bash
zr test                        # 运行 tests/ 下所有测试
zr test language_basics        # 运行指定测试
cargo test                     # 运行编译器自身的 Rust 单元测试
```

## 下一步

- 快速浏览全部语法 → [语法速览](/learn/syntax/)
- 把第一个程序编译到树莓派或 WebAssembly → [嵌入式与交叉编译](/learn/embedded/)
- 查看完整命令列表 → [命令行参考](/tools/cli/)