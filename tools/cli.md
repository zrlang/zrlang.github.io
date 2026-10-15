---
title: 命令行参考
description: zr 命令的全部选项——单文件编译模型、优化级别、目标三元组与各阶段 dump。
sidebar: tools
prev:
  title: 工具链
  url: /tools/
next:
  title: 支持的目标平台
  url: /tools/targets/
---

> **⚠️ zr 没有子命令。** 实际用法是 `zr [OPTIONS] <INPUT.zr>`。
> 本页以实际二进制的 `--help` 输出为准。仓库 README 里写的
> `zr build` / `check` / `run` / `test` / `fmt` / `doc` / `link`
> 是**规划**（见本页末尾），当前不可用。

## 实际用法

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
    --dump-tokens       Dump lexer output
    --dump-ast          Dump AST
    --dump-hir          Dump HIR
    --dump-mir          Dump MIR
    --dump-ssa          Dump SSA
    --dump-asm          Dump assembly
    --emit-llvm         Emit LLVM IR (future)
    -h, --help          Show this help
    -V, --version       Print version
```

一次只能编译**一个** `.zr` 文件。传入多个会报：

```
zr: multiple input files not supported yet
```

`-g` / `--debug`（生成 DWARF 调试信息）在解析器里已实现，但尚未出现在 `--help` 文本中。

## `-o`

输出文件名。不指定时使用与输入同名的默认名：

```bash
zr app.zr -o app
```

## `-O0` … `-O3` / `-Oz`

```bash
zr app.zr -O0 -o app      # 不优化，编译最快，保留全部调试信息
zr app.zr -O1 -o app      # 只做不改变语义的优化
zr app.zr -O2 -o app      # 默认推荐
zr app.zr -O3 -o app      # 展开内联、循环变换，体积换速度
zr app.zr -Oz -o app      # 针对体积优化
```

| 级别 | 常量折叠 | 死代码消除 | 内联 | 循环优化 | 体积 |
|:-----|:---------|:-----------|:-----|:---------|:-----|
| `-O0` | ✘ | ✘ | ✘ | ✘ | 最大 |
| `-O1` | ✔ | ✔ | 有限 | ✘ | 较大 |
| `-O2` | ✔ | ✔ | ✔ | ✔ | 适中（默认） |
| `-O3` | ✔ | ✔ | 更激进 | 更激进 | 较小 |
| `-Oz` | ✔ | ✔ | 按需 | ✔ | 最小 |

## `-c`

只编译不链接，产出目标文件：

```bash
zr lib.zr -c -o lib.o
```

三种原生容器（ELF / Mach-O / PE-COFF）下产出的 `.o` 都是可重定位目标文件，
可以交给平台链接器。wasm 没有可重定位对象格式，因此 `-c` 与链接等价。

## `--target`

目标三元组与 Cargo 的 `--target` 命名一致。不指定时用宿主平台。

```bash
zr app.zr --target aarch64-unknown-linux-gnu -o app-arm64
zr app.zr --target x86_64-apple-darwin        -o app-x64
zr app.zr --target wasm32-unknown-unknown     -o app.wasm
zr app.zr --target arm-none-eabi              -o app.elf
```

完整列表见[支持的目标平台](/tools/targets/)。

## `--wat`

`wasm32` 专用，输出 WebAssembly **文本**格式而非二进制，方便人读与调试：

```bash
zr app.zr --target wasm32-unknown-unknown --wat -o app.wat
```

## `--dump-*`

把编译流水线的任意中间结果打到标准输出。这是理解「编译器到底做了什么」
最快的手段：

```bash
zr program.zr --dump-tokens    # ① 词法：token 流与 span
zr program.zr --dump-ast       # ② 语法：AST（未做名称解析）
zr program.zr --dump-hir       # ③ 类型：HIR（名称已解析、类型已推导）
zr program.zr --dump-mir       # ④ 中级：基本块与终结器，控制流已脱糖
zr program.zr --dump-ssa       # ⑤ SSA：插入 φ 节点，寄存器重命名完成
zr program.zr --dump-asm       # ⑥ 后端：最终机器码
```

多个 `--dump-*` 可以同时给，按流水线顺序输出。

## `--emit-llvm`

输出 LLVM IR。标记为 `(future)` —— 当前是占位，不产生输出。

## `-V` / `--version`

```
zr 0.5.0
host: x86_64-apple-darwin (Mach-O)
targets: arm-none-eabi, riscv32-unknown-none, riscv64-unknown-none,
         x86_64-unknown-linux-gnu, aarch64-unknown-linux-gnu,
         x86_64-apple-darwin, aarch64-apple-darwin,
         x86_64-pc-windows-msvc, aarch64-pc-windows-msvc,
         wasm32-unknown-unknown, wasm32-wasi
```

## 用 `--dump-*` 做快速检查

因为没有 `zr check` 子机令，最快的类型检查循环是：

```bash
zr app.zr -c -o /dev/null
```

只编译、不链接、不落盘，适合放在编辑器保存钩子里。

## 退出行为

编译器成功时打印一行摘要到 stderr：

```
zr: compiled app.zr -> app (O2)
```

失败时打印诊断到 stderr 并以非零码退出。

## 规划中的子命令

zr 仓库 README 描述了一套更完整的 CLI。**这些都还没有实现**：

| 子命令 | 作用 | 计划版本 |
|:-------|:-----|:---------|
| `zr build <FILE>` | 编译并链接（当前就是默认行为） | 未排期 |
| `zr check <FILE>` | 仅类型检查 | 未排期 |
| `zr run <FILE>` | 编译并立即运行 | 未排期 |
| `zr test [NAME]` | 运行测试 | v0.7.0 |
| `zr fmt [FILE]` | 格式化 | v0.7.0 |
| `zr doc [FILE]` | 生成文档 | 未排期 |
| `zr pkg` | 包管理（`future/zpm/` 有设计文档） | v0.7.0 |
| `zr link` | 链接目标文件 | 未排期（当前需用平台链接器） |

路线图见[路线图](/community/roadmap/)。

## 现在想要 Cargo 行为怎么办

**单文件**：直接 `zr app.zr -o app`。

**多文件**：手动分成目标文件再链接。

```bash
zr main.zr   -c -o main.o
zr shapes.zr -c -o shapes.o
cc main.o shapes.o -lc -lm target/release/build/zr-*/out/libzrrt-macos_x86_64.a -o app
```

最后一步必须用平台链接器（`cc` / `clang` / `ld` / `lld-link`），
并显式加上 zr 的运行时静态库，否则会缺 `_zr_exit` 等符号。

**多依赖**：目前没有包管理器。可行做法是把所有代码写在一个 `.zr` 文件里，
或者把稳定的第三方库按需 `use` 进来。详见
[4. 包管理与项目](/learn/04-project/)。