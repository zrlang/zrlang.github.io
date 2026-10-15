---
title: 为什么 zr 用 let 和 var，而不是 mut
date: 2026-09-14
section: blog
author: zr Language Team
tags: [design, syntax]
description: 可变性应该是类型的一部分，而不是一个可选的修饰符。zr 选择把这件事说清楚。
excerpt: 「默认可变 + mut 才不可变」和「默认不可变 + var 才可变」都能工作。我们选了后者。
---

Rust 用 `let` 表示不可变、`let mut` 表示可变。这个设计有一个小问题：
`mut` 是个可以省略的后缀，而省略往往是有害的 —— 代码审查时你没法一眼看出
一个变量是否可写。

zr 的选择是：

```rust
let x = 42;          // 不可变
var counter = 0;     // 可变，一眼可见
```

## 三个理由

### 一、可读性

一行代码里，**有没有**可变比**可变在哪几个字符**更容易扫出来。

```rust
// Rust：需要数一下 mut 在哪儿
let mut a = 0; let b = 1; let mut c = 2;

// zr：一眼看到两个 var
var a = 0; let b = 1; var c = 2;
```

在几百行的函数里，这个差别会放大。

### 二、与值的生命周期对齐

`let` 和 `var` 描述的是**这个绑定本身**的属性，而不是类型系统的一部分。
zr 的函数签名里，`&mut T` 和 `&T` 的区分依旧存在 —— 借用规则完全一样：

```rust
fn borrow(s: &String) -> usize { return s.len(); }
fn append(s: &mut String, c: u8) { s.push_byte(c); }
```

可变**绑定**（`var`）与可变**引用**（`&mut`）是两个不同层面的概念，
分开命名可以让签名更精确。

### 三、和所有权的关系更清楚

`let` 创建的所有权，`var` 创建的也是 —— 区别只在「这个所有者能不能重新赋值」。
这一点在读代码时经常被 `mut` 的位置掩盖掉。

## 我们没有改变的部分

借用规则一个字都没动：

> 任意时刻，要么有任意多个不可变引用，要么恰好有一个可变引用。

这部分是 [所有权与借用](https://zrlang.github.io/learn/ownership/) 的核心，
写得越简单越好，我们没有理由在语法上再增加一层间接。