---
title: 社区
description: zr 是一个由社区驱动的开源项目。这里是参与讨论、贡献代码与追踪进度的入口。
sidebar: community_sidebar
prev: null
next:
  title: 路线图
  url: /community/roadmap/
---

zr 是一个**开源、由社区驱动**的系统编程语言项目，采用 MIT 许可证。

## 从哪里开始

| 我想… | 去这里 |
|:------|:-------|
| 看代码、提 issue | [github.com/zrlang/zr](https://github.com/zrlang/zr) |
| 讨论语言设计 | [GitHub Discussions](https://github.com/zrlang/zr/discussions) |
| 了解开发进度 | [路线图](/community/roadmap/) |
| 提交代码 | [贡献指南](/community/contributing/) |
| 看版本发布 | [博客](/blog/) |

## 设计哲学

zr 的六个原则，贯穿语言与标准库的每一个决定：

1. **显式优于隐式** —— 每个内存操作、所有权转移、错误处理都清晰可见。
2. **零成本抽象** —— 高层语法糖在编译期完全消除，运行时等同手写 C。
3. **内存安全是默认** —— 不牺牲安全性换取性能。
4. **渐进式复杂度** —— 从 `let x = 1` 到协程、泛型、`comptime`，按需深入。
5. **工具链即语言的一部分** —— 编译器、格式化器、文档生成器、包管理器是同一整体。
6. **与 C 共存** —— 不是「取代 C」，而是「更好地使用 C」。

## 代码仓库

zr 编译器用 Rust 编写，**只依赖标准库**，没有任何第三方依赖。

```
zr/
├── src/         编译器（Rust）
├── std/         标准库（zr）
├── runtime/     各目标运行时（汇编）
├── tests/       语言测试套件
├── examples/    示例程序
└── future/      未来语法与实验特性
```

仓库里最值得先读的两个文件：

- `examples/showcase.zr` —— 覆盖大部分语法的示例，是最好的语言速查。
- `tests/language_basics.zr` —— 语义规范的活文档。

## 行为准则

参与讨论时请保持：

- **对事不对人** —— 批评代码，不批评作者。
- **先问为什么** —— 每个设计选择背后都有权衡，讨论之前先找到它。
- **给出可验证的论据** —— 基准数据、编译产物、失败用例，比直觉更有说服力。

## 联系方式

- GitHub Issues —— [github.com/zrlang/zr/issues](https://github.com/zrlang/zr/issues)
- GitHub Discussions —— [github.com/zrlang/zr/discussions](https://github.com/zrlang/zr/discussions)

## 许可证

zr 采用 [MIT 许可证](https://github.com/zrlang/zr/blob/main/LICENSE)。
标准库、运行时与测试套件同样以 MIT 发布。