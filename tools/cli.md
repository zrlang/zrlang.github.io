---
title: 命令行参考
description: zr 的全部子命令与选项——编译、优化、跨平台编译、格式化、包管理、语言服务器。
sidebar: tools
prev:
  title: 工具链
  url: /tools/
next:
  title: 支持的目标平台
  url: /tools/targets/
---

## 用法

```
zr [OPTIONS] <INPUT.zr>        # 编译（单文件）
zr lsp                         # 语言服务器（stdio）
zr pkg <SUBCOMMAND> ...        # 包管理器
zr fmt [--check] <FILE>        # 格式化源码
zr clean                       # 清空增量编译缓存
```

子命令在解析输入文件之前就会被处理，所以它们不需要 `<INPUT.zr>`。

## 编译

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

一次只能编译**一个** `.zr` 文件。传入多个会报：

```
zr: multiple input files not supported yet
```

### 还有几个未出现在 `--help` 里但可用的选项

| 选项 | 作用 |
|:-----|:-----|
| `-g` / `--debug` | 生成 DWARF 调试信息 |
| `--no-incremental` | 关闭增量编译（默认**开启**） |
| `-v` / `--verbose` | 打印缓存命中等诊断信息 |

### 环境变量

| 变量 | 作用 |
|:-----|:-----|
| `ZR_TIME=1` | 把各编译阶段的耗时打到 stderr |

---

## `-o`

输出文件名。不指定时使用与输入同名的默认名：

```bash
zr app.zr -o app
```

## `-O0` … `-O3` / `-Oz`

```bash
zr app.zr -O0 -o app      # 不优化，编译最快
zr app.zr -O1 -o app      # 只做不改变语义的优化
zr app.zr -O2 -o app      # 默认推荐
zr app.zr -O3 -o app      # 展开内联、循环变换，体积换速度
zr app.zr -Oz -o app      # 针对体积优化
```

v0.6.0 之后的优化 pass 集合：常量折叠（整数/浮点/转换）、SCCP 稀疏条件常量传播、
死代码消除、死块消除、块内 CSE 与全局值编号、窥孔优化、循环不变量外提、
单块函数内联。

| 级别 | 常量折叠 | SCCP | DCE | 内联 | 循环优化 | 体积 |
|:-----|:---------|:-----|:----|:-----|:---------|:-----|
| `-O0` | ✘ | ✘ | ✘ | ✘ | ✘ | 最大 |
| `-O1` | ✔ | ✔ | ✔ | 有限 | ✘ | 较大 |
| `-O2` | ✔ | ✔ | ✔ | ✔ | ✔ | 适中（默认） |
| `-O3` | ✔ | ✔ | ✔ | 更激进 | 更激进 | 较小 |
| `-Oz` | ✔ | ✔ | ✔ | 按需 | ✔ | 最小 |

> **这些 pass 是被测过的**：每个语言用例都会在 `-O0` 到 `-Oz` 各跑一遍，
> 优化只要改坏语义就会在某个等级上变红。见[项目进展](/community/roadmap/)。

## `-c`

只编译不链接，产出目标文件：

```bash
zr lib.zr -c -o lib.o
```

三种原生容器（ELF / Mach-O / PE-COFF）下产出的 `.o` 是可重定位目标文件，
可以交给平台链接器。wasm 没有可重定位对象格式，因此 `-c` 与链接等价。

## `--target`

目标三元组与 Cargo 的 `--target` 命名一致。不指定时用宿主平台：

```bash
zr app.zr --target aarch64-unknown-linux-gnu -o app-arm64
zr app.zr --target wasm32-unknown-unknown     --wat -o app.wat
zr app.zr --target arm-none-eabi              -o app.elf
```

完整列表见[支持的目标平台](/tools/targets/)。

> 部分目标会**明确报错**而不是生成错误代码：ARM32 / RISC-V / wasm 后端
> 尚未实现浮点指令选择与指针/内存访问，遇到这些会直接失败。

## `--wat`

`wasm32` 专用，输出 WebAssembly **文本**格式而非二进制，方便人读与调试：

```bash
zr app.zr --target wasm32-unknown-unknown --wat -o app.wat
```

## 增量编译

**默认开启。** 源文件与所有模块的内容指纹都未变时复用上次产物。

```bash
zr app.zr -o app                      # 命中缓存
zr app.zr -o app -v                   # 打印缓存命中的诊断信息
zr app.zr -o app --no-incremental     # 强制全量重编
zr clean                              # 清空缓存
```

## `--dump-*`

把编译流水线的任意中间结果打到标准输出：

```bash
zr program.zr --dump-tokens      # ① 词法：token 流与 span
zr program.zr --dump-ast         # ② 语法：AST（未做名称解析）
zr program.zr --dump-hir         # ③ 类型：HIR（名称已解析、类型已推导）
zr program.zr --dump-mir         # ④ 中级：基本块与终结器，控制流已脱糖
zr program.zr --dump-ssa         # ⑤ SSA：φ 节点插入、寄存器重命名完成
zr program.zr --dump-ssa-after   # ⑥ 优化后的 SSA
zr program.zr --dump-asm         # ⑦ 最终机器码
```

**`--dump-ssa` 与 `--dump-ssa-after` 的对比是理解优化 pass 最直接的办法** ——
左边是循环刚转成 SSA 的样子（能看到插进去的 φ 节点），右边是 pass 跑完的样子。

多个 `--dump-*` 可以同时给。

## `zr fmt`

格式化源码：

```bash
zr fmt src/main.zr            # 就地格式化
zr fmt --check src/main.zr    # 只检查是否需要格式化（CI 用）
```

风格尚未定稿，排在 v0.8.0 的「格式化器 `zr fmt` 风格定稿」里。

## `zr pkg`

包管理器：

```
zr pkg <subcommand>

    init                    Create a zr.toml in the current directory
    add <name> <path>       Add a path dependency
    remove <name>           Remove a dependency
    list                    List dependencies
    tree                    Print the dependency graph
    build                   Build all dependencies in order
    clean                   Remove build artifacts
```

目前支持**路径依赖**（本地目录），注册表协议与联网能力排在 v0.8.0。

```bash
zr pkg init
zr pkg add mylib ../mylib
zr pkg tree
zr pkg build
```

详见 [4. 包管理与项目](/learn/04-project/)。

## `zr lsp`

启动语言服务器，走 stdio：

```bash
zr lsp
```

编辑器配置示例（VS Code）：

```json
{
  "zr-lsp": {
    "command": "zr",
    "args": ["lsp"]
  }
}
```

补全与跳转还在 v0.8.0 的路线里。

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

没有 `zr check` 子命令，最快的类型检查循环是：

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

## 还没做的子命令

| 子命令 | 作用 | 计划版本 |
|:-------|:-----|:---------|
| `zr check` | 仅类型检查 | 未排期 |
| `zr run` | 编译并立即运行 | 未排期 |
| `zr test` | 运行测试 | 未排期（目前用 `cargo test --test zr_language`） |
| `zr doc` | 生成文档 | 未排期 |
| `zr link` | 链接目标文件 | 未排期（当前需用平台链接器） |

路线图见[项目进展](/community/roadmap/)。

## 多文件项目

`zr link` 尚未实现，最后一步要自己调平台链接器并显式加上 zr 运行时静态库：

```bash
zr main.zr   -c -o main.o
zr shapes.zr -c -o shapes.o
cc main.o shapes.o -lc -lm target/release/build/zr-*/out/libzrrt-macos_x86_64.a -o app
```

漏掉运行时库会缺 `_zr_exit` 等符号。单文件编译时不需要这一步 ——
`zr app.zr -o app` 会自动挑选。