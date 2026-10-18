---
title: 编译器架构
description: zr 从源码到机器码的完整流水线：Lexer、Parser、Type Checker、MIR、SSA、优化、代码生成与容器写出。
sidebar: tools
prev:
  title: 支持的目标平台
  url: /tools/targets/
next: null
---

zr 编译器用 Rust 编写，**不依赖任何第三方 crate**（仅标准库），
采用经典的多阶段流水线架构。

## 全景图

```
源码 (.zr)
   │
   ▼ ① Lexer ────────── 词法分析（基于生成器的有限状态机）
   │
   ▼ ② Parser ──────── 语法分析（递归下降 + Pratt 表达式）
   │                   生成 AST
   ▼ ③ Type Checker ── 类型检查 + 类型推导（Hindley-Milner 子集）
   │   ├─ Name Resolution     名称解析
   │   ├─ HIR Construction    HIR 构建
   │   ├─ Type Inference      类型推断 / 统一
   │   ├─ Trait Solving       trait 约束求解
   │   ├─ Borrow Checking     借用检查（NLL）
   │   ├─ Exhaustiveness      模式穷尽性检查
   │   └─ Closure Analysis    闭包捕获分析
   ▼ ④ MIR ─────────── 中级表示（带基本块与终结器）
   │                   控制流脱糖、λ 提升
   ▼ ⑤ SSA ─────────── 静态单赋值形式
   │   ├─ 支配树 + 支配边界
   │   ├─ Cytron φ 节点插入
   │   └─ 寄存器重命名
   ▼ ⑥ Optimizer ───── 优化（可配置）
   │   ├─ 常量折叠
   │   ├─ 死代码消除（DCE）
   │   ├─ 公共子表达式消除（CSE）
   │   ├─ 全局值编号（GVN）
   │   ├─ 内联
   │   ├─ 循环优化
   │   └─ 窥孔优化
   ▼ ⑦ Code Generator ─ 指令选择 + 寄存器分配
   │   ├─ 指令选择（树覆盖）
   │   ├─ 线性扫描寄存器分配
   │   ├─ 栈帧布局
   │   └─ 汇编 / 机器码发射
   ▼ ⑧ Container Writer ─ ELF / Mach-O / PE-COFF / wasm
       └─ 平台链接器（ld · cc · lld-link）完成最终链接
```

每个阶段都可以用 `--dump-*` 单独观察：

```bash
zr program.zr --dump-tokens
zr program.zr --dump-ast
zr program.zr --dump-hir
zr program.zr --dump-mir
zr program.zr --dump-ssa
zr program.zr --dump-asm
```

## 各阶段说明

### ① Lexer

基于生成器的有限状态机，把源文件变成 token 流。每个 token 携带一个 `Span`
（源码区间），错误信息因此能精确指向出错的行列。注释与空白被丢弃但被保留为
`trivia`，供格式化器与文档生成器使用。

### ② Parser

递归下降处理声明与语句，Pratt 算法处理运算符表达式 —— 后者让运算符优先级
与结合性成为一张可声明的表，而不是散落在代码里的 if/else。产物是未解析的 AST。

### ③ Type Checker

这是前端的核心，包含七个子步骤：

| 子步骤 | 职责 |
|:-------|:-----|
| Name Resolution | 把标识符解析到具体的定义，处理遮蔽（shadowing） |
| HIR Construction | 构建高层中间表示，消除语法糖 |
| Type Inference | Hindley-Milner 统一（unification）推导类型 |
| Trait Solving | 求解 `T: Ord` 这类约束，挑选 `impl` |
| Borrow Checking | NLL 借用检查，计算活跃借用区间 |
| Exhaustiveness | 证明 `match` 覆盖了所有可能 |
| Closure Analysis | 分析闭包捕获哪些变量、按引用还是按值 |

推导出的 HIR 同时携带**类型**和**所有权/借用信息**，后端因此不需要重新推导。

### ④ MIR

控制流脱糖（把 `match`、`for`、`?` 展开成跳转与分支）、`λ` 提升（把所有闭包
变成顶层函数）、内联小函数。产物是带基本块与终结器的 SSA 之前的中间表示。

### ⑤ SSA

构造静态单赋值形式：计算支配树与支配边界，按 Cytron 算法插入 φ 节点，
最后做寄存器重命名。这一步消除了 φ 带来的「看似可变」问题，
让后续优化可以用简单的数据流分析。

### ⑥ Optimizer

一组可配置的数据流 pass。顺序很重要：先做会暴露新机会的变换
（内联、GVN），再做清理（常量折叠、DCE、CSE），最后是局部变换（窥孔）。

### ⑦ Code Generator

树覆盖指令选择把 MIR 指令映射成目标指令，然后是**线性扫描寄存器分配**
（参考 HotSpot / LLVM 的做法），最后做栈帧布局并发射机器码。

### ⑧ Container Writer

把目标文件封装成对应平台的容器格式：ELF（32/64）、Mach-O、PE/COFF、wasm。
随后交给平台链接器完成重定位与符号解析。

## 编译模型

zr 采用**单态化泛型**（monomorphization），与 Rust / C++ 类似：

- 泛型函数在编译期为每个具体类型生成一份代码。
- trait 约束在编译期解析完毕，运行时没有任何分发开销。
- 代价：二进制体积随泛型实例数增长。

增量编译与 LTO 在路线图上（`src/opt/` 下已有 `lto.rs` 与 `pgo.rs` 的框架）。

## 设计参考

| 组件 | 参考来源 |
|:-----|:---------|
| MIR → LLVM / Cranelift | Rust（`rustc_codegen_llvm`） |
| 自带后端与交叉编译 | Zig |
| 字节码虚拟机 | Python（CPython） |
| Hindley-Milner 类型推导 | ML / Haskell / Rust |
| 借用检查器（NLL） | Rust |
| 线性扫描寄存器分配 | Java HotSpot / LLVM |
| C 兼容 ABI | Zig / C2 |

## 源码结构

```
zr/
├── Cargo.toml              # Rust 项目配置（无第三方依赖）
├── build.rs                # 为各目标构建运行时静态库
├── src/                    # 编译器源码
│   ├── main.rs             # 入口与 CLI
│   ├── error.rs            # 错误类型与诊断
│   ├── lexer/              # 词法分析
│   ├── parser/             # 语法分析（ast / decl / expr / stmt / ty）
│   ├── typeck/             # 类型检查
│   ├── mir/                # 中级表示与构建器
│   ├── ssa/                # SSA 构造与支配树
│   ├── opt/                # 优化 pass、pass manager、LTO、PGO
│   ├── codegen/            # 代码生成（encoder / regalloc / linker / 各容器）
│   ├── macro_system/       # 宏展开
│   └── zpm/                # 包管理（规划中）
├── std/                    # 标准库（zr 编写）
├── runtime/                # 各目标运行时（汇编）
├── tests/                  # 语言测试套件
├── examples/               # 示例程序
└── future/                 # 未来语法与实验特性
```

## 自己动手

想理解一个具体功能怎么实现的，最好的方式是 `dump` 出来看：

```bash
# 看看 for 循环脱糖成什么样
zr examples/showcase.zr --dump-mir

# 看看单态化后产生了多少份代码
zr examples/generics_demo.zr -O2 --dump-asm
```

仓库里的 `examples/showcase.zr` 覆盖了大部分语法，是很好的实验素材。

> **⚠️ 当前状态**：v0.6.0 补齐了 SSA 构造（迭代支配边界插 φ）、活跃性分析与栈溢出，
> 循环、递归、`comptime`、`match` 脱糖都已可用；但枚举、泛型/trait、闭包、
> 切片仍未实现。逐章的阻塞原因见[项目进展](/community/roadmap/)。