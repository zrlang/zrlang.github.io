---
title: 支持的目标平台
description: zr 的 11 个目标三元组：Linux、macOS、Windows、WebAssembly 与裸机 ARM / RISC-V 的后端、容器格式与运行时。
sidebar: tools
prev:
  title: 命令行参考
  url: /tools/cli/
next:
  title: 编译器架构
  url: /tools/architecture/
---

zr 编译器自带指令选择与寄存器分配，可以直接产出目标平台的机器码与容器格式。
完整的支持矩阵如下。

## 总览

| 目标三元组 | 指令后端 | 容器格式 | 运行时 | 链接方式 |
|:-----------|:---------|:---------|:-------|:---------|
| `arm-none-eabi` | ARM32（A32） | ELF32 裸机映像 | `rt_arm_baremetal.s`（semihosting） | 无需链接器 |
| `riscv32-unknown-none` | RV32IMAC | ELF32 裸机映像 | `rt_riscv_baremetal.s`（semihosting） | 无需链接器 |
| `riscv64-unknown-none` | RV64IMAC | ELF64 裸机映像 | `rt_riscv_baremetal.s`（semihosting） | 无需链接器 |
| `x86_64-unknown-linux-gnu` | x86-64 | ELF | `rt_linux_x86_64.s`（裸系统调用） | `ld -static` 或 gcc |
| `aarch64-unknown-linux-gnu` | AArch64 | ELF | `rt_linux_aarch64.s`（裸系统调用） | `ld -static` 或 gcc |
| `x86_64-apple-darwin` | x86-64 | Mach-O | `rt_macos_x86_64.s`（libSystem） | `cc` / `clang` |
| `aarch64-apple-darwin` | AArch64 | Mach-O | `rt_macos_arm64.s`（libSystem） | `clang -target` |
| `x86_64-pc-windows-msvc` | x86-64 | PE/COFF | `rt_windows_x86_64.s`（kernel32） | `lld-link` / mingw |
| `aarch64-pc-windows-msvc` | AArch64 | PE/COFF | `rt_windows_arm64.s`（kernel32） | `lld-link` / mingw |
| `wasm32-unknown-unknown` | 栈式字节码 | wasm | 模块导入（`zr.*`） | 无需链接器 |
| `wasm32-wasi` | 栈式字节码 | wasm | 模块导入（`zr.*`） | 无需链接器 |

```bash
zr app.zr --target <TRIPLE> -o out
```

## 裸机目标

三个 `*-unknown-none` / `arm-none-eabi` 目标直接产出**可烧录的 ELF 映像**，
既不需要链接器也不需要 C 运行时。

### 与普通 ELF 的差异

- **没有 Program Header** —— `e_entry` 直接指向 `_start`，节地址从 `0x08000000`
  （Cortex-M 向量表）起算。烧录工具与仿真器按节加载即可。
- **没有「退出进程」** —— `_start` 调用 `main` 之后停在自循环；
  返回与否交给调试器或复位处理。调试输出走 semihosting。

### 架构约束

- **ARM** 使用 A32 编码。`thumbv7em-*` 暂不支持，遇到会显式拒绝。
  除法使用 `sdiv` / `mls`，因此需要 **ARMv7-R 或 ARMv7-A**
  （M 核没有硬件除法指令）。
- **RISC-V** 没有条件执行 —— 比较结果必须用 `seqz` / `slt` 显式物化。
  除法余数固定写回 `a0`，需要一次搬运；大常量用 `lui` + `addi` 拼装。

## 原生目标

### Linux

`_start` 直接用系统调用退出进程，**不依赖运行时**。默认静态链接：

```bash
zr app.zr --target x86_64-unknown-linux-gnu -o app
zr app.zr --target aarch64-unknown-linux-gnu -o app-arm64
```

### macOS

`_start` 调用运行时的 `zr_exit`，转发到 libc：

```bash
zr app.zr --target x86_64-apple-darwin  -o app-x64
zr app.zr --target aarch64-apple-darwin -o app-arm64
```

### Windows

`_start` 调用运行时的 `zr_exit`，转发到 `ExitProcess`：

```bash
zr app.zr --target x86_64-pc-windows-msvc  -o app.exe
zr app.zr --target aarch64-pc-windows-msvc -o app-arm64.exe
```

## WebAssembly

`wasm32` 使用栈式字节码后端（参考 CPython 的字节码虚拟机设计），
运行时能力通过模块导入 `zr.*` 提供，无需链接器。

```bash
zr app.zr --target wasm32-unknown-unknown -o app.wasm
zr app.zr --target wasm32-unknown-unknown --wat -o app.wat
zr app.zr --target wasm32-wasi            -o app.wasm
```

- `--wat` 输出 WebAssembly 文本格式，可直接阅读。
- wasm 没有可重定位对象格式，因此 `-c` 与链接等价。

## 运行时库的构建

`build.rs` 为每个**当前可用**的目标产出 `libzrrt-<平台>.a`，编译器链接用户程序时
按目标三元组自动选取。缺少交叉工具链时该目标会被**安静跳过** ——
这意味着你可以在只装了 x86-64 Linux 工具链的机器上构建 zr 编译器本身。

## `-c` 的语义

| 容器 | `-c` 的产物 | 能否交给平台链接器 |
|:-----|:-----------|:-------------------|
| ELF | `.o` 可重定位目标文件 | ✔ |
| Mach-O | `.o` 可重定位目标文件 | ✔ |
| PE/COFF | `.obj` 可重定位目标文件 | ✔ |
| wasm | 模块 | ✘（等价于链接） |

## 规划中

路线图里还会增加：

- **更多架构** —— wasm64、Thumb-2
- **更多平台** —— FreeBSD、Android、iOS
- **32 位目标的多字长（i64）算术** —— 目前 32 位目标的 `i64` 运算按两次 32 位运算模拟

详见 [路线图](/community/roadmap/)。