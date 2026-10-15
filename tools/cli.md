---
title: 命令行参考
description: zr 命令的全部子命令与选项：build、check、run、test、link，以及优化级别、目标三元组与各阶段 dump。
sidebar: tools
prev:
  title: 工具链
  url: /tools/
next:
  title: 支持的目标平台
  url: /tools/targets/
---

```
zr <COMMAND> [OPTIONS] <INPUT>

COMMANDS:
  build <FILE>     编译并链接为可执行文件（默认）
  check <FILE>     仅类型检查，不生成代码
  run <FILE>       编译并立即运行
  test [NAME]      运行测试
  fmt [FILE]       格式化代码（规划中）
  doc [FILE]       生成文档（规划中）

OPTIONS:
  -o, --output <FILE>     输出文件名
  -O0..-O3, -Oz           优化级别
  -c                      只编译不链接
  --target <TRIPLE>       目标三元组（默认：宿主平台）
  --wat                   输出 WebAssembly 文本（wasm32 专用）
  --dump-tokens           dump 词法分析结果
  --dump-ast              dump AST
  --dump-hir              dump HIR
  --dump-mir              dump MIR
  --dump-ssa              dump SSA
  --dump-asm              dump 机器码
  --emit-llvm             输出 LLVM IR（规划中）
  -h, --help              显示帮助
  -V, --version           显示版本
```

## build

编译并链接为可执行文件。这是默认命令，`zr app.zr` 等价于 `zr build app.zr`。

```bash
# 默认：产出与源文件同名的可执行文件
zr build app.zr

# 指定输出名
zr build app.zr -o app

# 优化级别
zr build app.zr -O0 -o app      # 不优化，编译最快，保留全部调试信息
zr build app.zr -O1 -o app      # 只做不改变语义的优化
zr build app.zr -O2 -o app      # 默认推荐
zr build app.zr -O3 -o app      # 展开内联、循环变换，体积换速度
zr build app.zr -Oz -o app      # 针对体积优化

# 只编译不链接
zr build lib.zr -c -o lib.o

# 链接 C 库
zr build app.zr -lc -lm -o app
```

### 优化级别

| 级别 | 常量折叠 | 死代码消除 | 内联 | 循环优化 | 体积 |
|:-----|:---------|:-----------|:-----|:---------|:-----|
| `-O0` | ✘ | ✘ | ✘ | ✘ | 最大 |
| `-O1` | ✔ | ✔ | 有限 | ✘ | 较大 |
| `-O2` | ✔ | ✔ | ✔ | ✔ | 适中（默认） |
| `-O3` | ✔ | ✔ | 更激进 | 更激进 | 较小 |
| `-Oz` | ✔ | ✔ | 按需 | ✔ | 最小 |

## check

只做类型检查与借用检查，不生成任何文件。这是最快的反馈循环，适合放在编辑器保存钩子里：

```bash
zr check src/*.zr
```

## run

编译并立即运行。适合快速验证小程序：

```bash
zr run hello.zr
```

## test

运行 `tests/` 目录下的语言测试：

```bash
zr test                        # 全部
zr test language_basics        # 指定测试名
```

## link

链接已有的目标文件：

```bash
zr build main.zr -c -o main.o
zr build lib.zr  -c -o lib.o
zr link main.o lib.o -o app
```

## --target

目标三元组与 Cargo 的 `--target` 命名一致：

```bash
zr app.zr --target aarch64-unknown-linux-gnu -o app-arm64
zr app.zr --target x86_64-apple-darwin        -o app-x64
zr app.zr --target wasm32-unknown-unknown     -o app.wasm
zr app.zr --target arm-none-eabi              -o app.elf
```

完整列表见 [支持的目标平台](/tools/targets/)。

## --dump-*

把编译流水线的任意中间结果打到标准输出。这是理解「编译器到底做了什么」
最快的手段：

```bash
zr build program.zr --dump-tokens    # ① 词法：token 流与 span
zr build program.zr --dump-ast       # ② 语法：AST（未做名称解析）
zr build program.zr --dump-hir       # ③ 类型：HIR（名称已解析、类型已推导）
zr build program.zr --dump-mir       # ④ 中级：基本块与终结器，控制流已脱糖
zr build program.zr --dump-ssa       # ⑤ SSA：插入 φ 节点，寄存器重命名完成
zr build program.zr --dump-asm       # ⑥ 后端：最终机器码
```

每一步的输入输出关系见 [编译器架构](/tools/architecture/)。

## --wat

`wasm32` 专用，输出 WebAssembly 文本格式而非二进制，方便人读：

```bash
zr app.zr --target wasm32-unknown-unknown --wat -o app.wat
```

## -c 与 wasm

三种原生容器（ELF / Mach-O / PE-COFF）下，`-c` 产出可重定位目标文件，
可以交给平台链接器。wasm 没有可重定位对象格式，因此 `-c` 与链接等价。

## 环境变量

| 变量 | 作用 |
|:-----|:-----|
| `ZR_TARGET` | 默认目标三元组，省去每次写 `--target` |
| `ZR_DUMP` | 默认打开某个 `--dump-*`，等价于加该选项 |
| `ZR_LINKER` | 覆盖平台链接器（默认按目标选择 `ld` / `cc` / `lld-link`） |
| `RUST_BACKTRACE` | 编译器自身崩溃时打印 Rust 回溯 |

## 退出码

| 码 | 含义 |
|:---|:-----|
| `0` | 成功 |
| `1` | 编译错误（源码有错） |
| `2` | 命令行用法错误 |
| `3` | 内部错误（请提 issue） |
| 程序自身的 | 由 `main` 的返回值决定（`i32`） |