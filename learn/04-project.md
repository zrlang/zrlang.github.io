---
title: 4. 包管理与项目
description: zr 没有 Cargo，但有 zr pkg、zr fmt、zr lsp 与增量编译。本章讲它的编译模型、模块与可见性。
sidebar: learn
status: partial
status_note: >-
  zr pkg（init / add / remove / list / tree / build / clean）、zr fmt、
  zr lsp 与增量编译（默认开启）都已落地。目前 zr pkg 只支持路径依赖，
  注册表协议与联网排在 v0.8.0；模块系统仍不完整，可靠做法是一个项目一个文件。
prev:
  title: 3. 结构体与枚举
  url: /learn/03-structs-enums/
next:
  title: 5. 集合类型
  url: /learn/05-collections/
---

Rust 用 Cargo 做构建、依赖与工作空间。**zr 没有 Cargo，但已经有自己的
`zr pkg` / `zr fmt` / `zr lsp`**，这一章讲它实际是怎么组织的，以及
和 Cargo 的差别在哪。

## 现状：单文件编译

`zr` 的真实用法是「一个输入文件」：

```
zr [OPTIONS] <INPUT.zr>
```

也就是说，一次编译的输入是**一个 `.zr` 文件**。没有 `Cargo.toml`，
没有依赖解析，没有 crates.io，没有工作空间。

```bash
zr app.zr -o app
zr app.zr --target aarch64-apple-darwin -o app-arm64
zr check_ish.zr -c -o /dev/null    # -c 只编译不链接，用来做快速语法检查
```

完整选项见[命令行参考](/tools/cli/)。

## 标准库的按需加载

`zr` 没有内建 `mod` 搜索路径，它用的是**按需加载**：看到 `use` 才去 `std/` 找。

```rust
use io::{println, println_int};
```

编译器的行为是：

1. 遇到 `use io::{println}`，去 `std/io.zr` 找 `io`；
2. 把该文件的定义并进当前编译单元；
3. 递归处理这个文件自己的 `use`。

这样设计有三个理由：

- **只加载真正用到的模块。** `std/` 一共 9 个模块约 3900 行，无脑全并进来
  会把没人用的代码也发射出去，二进制白白变大。
- **避免跨模块重名冲突。** 并进来的是**扁平命名空间**，同时加载的两个模块
  不能有同名 `pub fn`（例如 `collections` 和 `slice` 都有 `len`）。
  要彻底解决，得把符号表改成 `module::name` 的两层结构。
- **未完成的模块可以被跳过。** 例如 `net.zr` 依赖尚未实现的 `zr_socket`，
  用不到就不该编译它。

### 这个设计的代价

按需加载带来一个真实的限制：**同时加载的两个模块不能有同名顶层 `pub fn`**。
写代码时要留意模块之间的命名冲突。

## `use` 的四种写法

```rust
// 导入整个模块
use std::io;
io::println("hello");

// 选择性导入
use std::collections::Vec;
use std::string::String;

// 组合导入
use std::io::{println, println_int, print_fmt};

// 重命名
use std::string::String as StringBuilder;
```

标准库本身在 `std/` 下面，源码里写的是 `use io::...`、`use core::...`，
编译器会自动补上 `std::` 前缀。

## `mod`

```rust
mod geometry;             // 加载同目录的 geometry.zr

mod geometry {            // 内联模块
    pub fn area() -> i32 { return 0; }
}
```

模块系统尚未完整：跨文件依赖没有打通，`mod geometry;` 里的 `geometry.zr`
不能可靠地 `use` 主模块的东西。目前可靠的用法是**把所有代码写在一个文件里**，
需要拆分时用 `zr` 分别编译成目标文件再链接（见下）。

## 可见性

zr 的可见性关键字与 Rust 一致：

```rust
pub struct PublicStruct {
    pub field: i32,           // 公开字段
    internal: i32,            // 私有（默认）
}

pub(crate) fn crate_local() {}   // 仅当前 crate 可见
pub(super)  fn parent_only() {}  // 仅父模块可见
```

`pub` 用在声明上，导出名字；模块内的字段、函数默认私有。

## 多文件项目：目前怎么做

因为一次编译一个文件，多文件项目要手动分成目标文件，再用**平台链接器**链接：

```bash
# 1. 分别产出目标文件
zr main.zr   -c -o main.o
zr shapes.zr -c -o shapes.o

# 2. 链接，并指明 zr 运行时静态库
RT=target/release/build/zr-*/out/libzrrt-macos_x86_64.a   # 换成你的平台
cc main.o shapes.o "$RT" -lc -lm -o app
```

三种原生容器（ELF / Mach-O / PE-COFF）产出的 `.o` 都是可重定位目标文件，
可以直接交给 `cc` / `clang` / `ld` / `lld-link`。

运行时静态库由 `build.rs` 在构建编译器时按平台产出：
`libzrrt-linux_x86_64.a`、`libzrrt-macos_arm64.a`、
`libzrrt-linux_aarch64.a`、`libzrrt-bare_arm.a` …，
宿主平台另有传统名字 `libzrrt.a`。漏掉它会缺 `_zr_exit` 等符号。

> `zr link` **尚未实现**（传多个输入会报 `multiple input files not supported yet`），
> 所以最后一步必须自己调平台链接器。
> 单文件时不需要这一步 —— `zr app.zr -o app` 会自动挑选运行时库。

`wasm32` 没有可重定位对象格式，`-c` 与链接等价。

如果你现在就想在 zr 上写多文件项目，这是一个可行但笨的办法。

## `zr pkg`：zr 的包管理器

`zr pkg` 已经可用，但目前只支持**路径依赖**（本地目录）：

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

典型流程：

```bash
zr pkg init                  # 生成 zr.toml
zr pkg add mylib ../mylib    # 加一个路径依赖
zr pkg list                  # 列出依赖
zr pkg tree                  # 打印依赖图
zr pkg build                 # 按依赖顺序构建全部
```

### 还没做的

| 能力 | 状态 |
|:-----|:-----|
| 路径依赖（本地目录） | ✔ |
| 依赖图与拓扑构建顺序 | ✔ |
| 注册表协议与联网拉取 | ✘ 排在 v0.8.0 |
| 版本号语义化与冲突求解 | ✘ 设计文档已写（`future/zpm/`，PubGrub） |
| 锁文件 `zpm.lock` | ✘ 设计文档已写 |
| 沙箱化构建脚本 `build.zr` | ✘ 设计文档已写 |

编译器侧的实现是 `src/pkg.rs`，配套的 JSON 解析在 `src/json.rs`。

## `zr fmt` 与 `zr lsp`

```bash
zr fmt src/main.zr            # 就地格式化
zr fmt --check src/main.zr    # 只检查（CI 用）
zr lsp                        # 语言服务器，stdio
```

`zr fmt` 的风格还没定稿（排在 v0.8.0），`zr lsp` 的补全与跳转也在 v0.8.0 路线里。
编辑器配置示例：

```json
{
  "zr-lsp": {
    "command": "zr",
    "args": ["lsp"]
  }
}
```

## 增量编译

**默认开启。** 源文件与所有模块的内容指纹都未变时复用上次产物。

```bash
zr app.zr -o app                    # 命中缓存
zr app.zr -o app -v                 # 打印缓存命中的诊断信息
zr app.zr -o app --no-incremental   # 强制全量重编
zr clean                            # 清空缓存
```

增量编译只覆盖**单文件**场景。多文件项目目前仍然要把每个文件编译成目标文件
再手动链接。

## 与 Cargo 的对照

| 能力 | Cargo | zr 现状 |
|:-----|:------|:--------|
| 清单文件 | `Cargo.toml` | ✔ `zr.toml` |
| 编译单个文件 | `cargo build --bin x` | ✔ `zr x.zr -o x` |
| 路径依赖 | `path = "..."` | ✔ `zr pkg add` |
| 注册表 / 联网 | crates.io | ✘ 排在 v0.8.0 |
| 版本约束与冲突求解 | PubGrub | ✘ 设计文档已写 |
| 锁文件 | `Cargo.lock` | ✘ 设计文档已写 |
| 构建脚本 | `build.rs` | ✘ 设计文档已写 |
| 格式化 | `cargo fmt` | ✔ `zr fmt`（风格未定稿） |
| 语言服务器 | rust-analyzer | ✔ `zr lsp`（补全/跳转待做） |
| 增量编译 | ✔ | ✔（仅单文件） |
| 多线程编译 | ✔ | ✘ 排在 v0.7.0 |
| 工作空间 | `[workspace]` | ✘ |
| 标准库组织 | 编译进二进制 | **按需加载 `std/*.zr`** |
| 多文件 | 自动 | 手动 `-c` + 平台链接器 |

zr 选择让标准库用 zr 自己写（自举方向），而不是像 Cargo 那样把标准库编译进
`rustc`。这让「换一个目标平台」只需要替换 `extern "C"` 的实现，
但也意味着标准库的模块边界要更小心 —— 而且 `use` 拉进来的模块处在同一个
扁平命名空间里，两个模块不能有同名 `pub fn`。

## 小结

```bash
zr app.zr -o app                       # 单文件编译（运行时库自动挑选）
zr pkg init && zr pkg add lib ../lib   # 路径依赖
zr fmt src/main.zr                     # 格式化
zr lsp                                 # 语言服务器
zr app.zr -o app --no-incremental      # 关掉增量，强制全量
```

多文件目前仍要手动：`zr a.zr -c -o a.o`，再用平台链接器链接。

下一步：[5. 集合类型](/learn/05-collections/)。

