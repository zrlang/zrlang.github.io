---
title: 贡献指南
description: 如何为 zr 贡献代码、文档、标准库与测试。
sidebar: community_sidebar
prev:
  title: 路线图
  url: /community/roadmap/
next: null
---

欢迎贡献！zr 是一个小而专注的项目，贡献方式很简单：**提一个 issue，或者发一个 PR。**

## 环境准备

构建编译器只需要一套 Rust 工具链（≥ 1.70）。zr 编译器本身**不依赖任何第三方 crate**，
所以 `cargo build` 不会拉取额外依赖。

```bash
git clone https://github.com/zrlang/zr.git
cd zr

cargo build              # 调试版本，编译快
cargo test               # 编译器自身的单元测试
cargo fmt                # 格式化
cargo clippy             # 静态检查
```

构建产物在 `target/debug/zr`。

## 开发工作流

```bash
# 1. 写一个 zr 程序当作实验素材
cat > /tmp/demo.zr <<'EOF'
fn main() -> i32 {
    let mut i = 0;
    while i < 10 { i += 1; }
    return 0;
}
EOF

# 2. 用 dump 看编译器的每一步
./target/debug/zr build /tmp/demo.zr --dump-ast
./target/debug/zr build /tmp/demo.zr --dump-mir
./target/debug/zr build /tmp/demo.zr --dump-ssa
./target/debug/zr build /tmp/demo.zr --dump-asm

# 3. 跑语言测试
./target/debug/zr test tests/language_basics.zr
./target/debug/zr test
```

调试前端问题时，`--dump-*` 几乎总是最快的切入点 —— 你能直接看到是哪一步把
语义弄丢了。

## 提交代码之前

- [ ] `cargo build` 通过
- [ ] `cargo test` 通过
- [ ] `cargo fmt` 已运行
- [ ] `cargo clippy` 无新增警告
- [ ] 如果改了语言行为，同时更新 `tests/language_basics.zr`
- [ ] 如果改了标准库，更新 `/std/` 页面对应的说明

## 代码风格

| 方面 | 约定 |
|:-----|:-----|
| 语言 | Rust 2021 edition，仅使用标准库 |
| 命名 | 类型/枚举 `CamelCase`，函数/变量 `snake_case`，常量 `SCREAMING_SNAKE` |
| 注释 | 解释**为什么**，不复述**做了什么** |
| 错误处理 | 用 `crate::error` 的诊断类型，不要 `unwrap()` |
| 新增 pass | 在 `src/opt/pass_manager.rs` 注册 |

## 贡献什么最有用

按「影响人数 ÷ 所需时间」排序，大致是：

1. **编译器诊断信息** —— 把 `expected X, found Y` 变成「你可能想写的是 Z」。
2. **标准库缺失功能** —— `std::string` 缺方法、`std::net` 不完整。
3. **语言测试用例** —— 边界情况、报错场景。
4. **文档** —— 尤其是「为什么这样设计」的解释。
5. **后端优化** —— 收益大，但需要熟悉目标平台。

## 参与语言设计讨论

语言语义的改变（关键字、类型规则、标准库 API 的稳定性）需要先在
[Discussions](https://github.com/zrlang/zr/discussions) 里讨论。发起讨论时请包含：

- **你想解决什么问题** —— 而不是「我想加什么语法」。
- **至少两个方案** —— 以及它们各自的代价。
- **zr 的六条设计哲学**如何适用。

## 提交 Pull Request

1. 从 `main` 切出分支：`git checkout -b fix/borrow-checker-false-positive`
2. 提交尽量小而聚焦 —— 一个 PR 做一件事。
3. 提交信息说明**为什么**，而不只是改了什么。
4. 在 PR 描述里链接相关的 issue。

## 行为准则

- 对事不对人。
- 先问为什么，再谈怎么改。
- 给出可验证的论据：基准数据、编译产物、可复现的失败用例。

## 许可证

提交即表示你同意你的贡献以 MIT 许可证发布。