---
title: 4. 包管理与项目
description: zr 没有 Cargo。本章讲它实际的编译模型、模块与可见性，以及 zr pkg 包管理器的规划。
sidebar: learn
status: partial
status_note: >-
  标准库按需加载已落地（<code>use</code> 只拉取用到的 <code>std/*.zr</code>），
  但模块系统仍不完整：<code>zr pkg</code> 包管理器要到 v0.7.0，跨文件依赖尚未打通。
prev:
  title: 3. 结构体与枚举
  url: /learn/03-structs-enums/
next:
  title: 5. 集合类型
  url: /learn/05-collections/
---

Rust 用 Cargo 做构建、依赖与工作空间。**zr 目前没有 Cargo**，这一章讲的是
它实际是怎么组织的，以及替代方案是什么。

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

## `zr pkg`：规划中的包管理器

`zr pkg` 排在 v0.7.0 路线图上。仓库 `future/zpm/` 已经写好了设计文档：

| 文档 | 内容 |
|:-----|:-----|
| `registry_protocol.md` | 注册表 REST 端点 |
| `lockfile_format.md` | `zpm.lock` 结构 |
| `dependency_resolution.md` | 基于 PubGrub 的依赖求解器 |
| `build_scripts.md` | 沙箱化的 `build.zr` |

设计目标与 Cargo 对齐：

- 声明式清单（`zr.toml`），描述包名、版本、依赖；
- 版本号语义化；
- `zpm.lock` 锁定精确版本，保证可复现构建；
- PubGrub 算法求解依赖冲突并解释「为什么这两个版本不兼容」；
- 构建脚本在沙箱中执行。

编译器里已经有 `src/zpm/`（注册表、构建脚本），但还没有接到命令行上。

## 与 Cargo 的对照

| 能力 | Cargo | zr 现状 |
|:-----|:------|:--------|
| 清单文件 | `Cargo.toml` | 无（规划中 `zr.toml`） |
| 编译单个文件 | `cargo build --bin x` | `zr x.zr -o x` |
| 依赖管理 | `Cargo.lock` + crates.io | 无 |
| 依赖求解 | PubGrub | 设计文档已写（`future/zpm/`） |
| 构建脚本 | `build.rs` | 设计文档已写 |
| 工作空间 | `[workspace]` | 无 |
| 标准库组织 | 编译进二进制 | **按需加载 `std/*.zr`** |
| 多文件 | 自动 | 手动 `-c` + 平台链接器 |

zr 选择让标准库用 zr 自己写（自举方向），而不是像 Cargo 那样把标准库编译进
`rustc`。这让「换一个目标平台」只需要替换 `extern "C"` 的实现，
但也意味着标准库的模块边界要更小心。

## 小结

现在：

```bash
zr app.zr -o app                       # 单文件（运行时库自动挑选）
zr main.zr -c -o main.o                 # 多文件（最后一步要自己调平台链接器）
```

未来（v0.7.0）：

```bash
zr pkg add <name>       # 加依赖
zr pkg build           # 解析依赖 + 构建
```

下一章：[5. 集合类型](/learn/05-collections/)。