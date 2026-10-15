---
title: 6. 错误处理
description: panic、Result、? 运算符——错误是值，传播是运算符，zr 里没有异常。
sidebar: learn
status: planned
status_note: 断言内建与 <code>Result</code> 尚未实现。
prev:
  title: 5. 集合类型
  url: /learn/05-collections/
next:
  title: 7. 泛型、Trait 与生命周期
  url: /learn/07-generics/
---

zr 没有异常。所有可能失败的函数都在**返回类型**里声明这一点 ——
调用点一眼就能看出这个函数会不会失败。

> **⚠️ 当前状态**：断言内建（`assert` / `assert_eq`）与 `Result` 尚未实现。
> 本章是设计说明。

## 两种失败

zr 把失败分成两类，处理方式完全不同：

| 类型 | 用于 | 行为 |
|:-----|:-----|:-----|
| **可恢复** `Result<T, E>` | 程序可以合理应对的情况 | 值，返回给调用者 |
| **不可恢复** `panic` | bug 或无法继续 | 打印诊断、展开栈、终止进程 |

规则很简单：**常规错误是数据，只有 bug 才是控制流**。

## `panic`

```rust
use core::panic;

fn checked_index(v: &Vec<i32>, i: usize) -> i32 {
    if i >= v.len() {
        panic("index out of range");
    }
    return v.get(i);
}
```

`panic` 的返回类型是 `!`（永不返回），所以它可以出现在任何位置而不影响控制流分析：
编译器知道这一点之后的代码不会执行。

同一组里还有三个相关函数：

| 函数 | 用途 |
|:-----|:-----|
| `panic(msg)` | 明确的运行时错误 |
| `unimplemented()` | 计划中但没写 |
| `unreachable()` | 按逻辑不可能走到 |

标准库测试就是这么用的：

```rust
fn test_unreachable() -> i32 {
    // 某些编译器内部路径用它标记「这里应该已经处理完了」
    return 0;
}
```

## `Result`

`Result<T, E>` 是标准库里的枚举：

```rust
pub enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

因为它是枚举，[3. 结构体与枚举](/learn/03-structs-enums/) 里的穷尽性检查同样适用 ——
漏掉一个分支是编译错误，不是运行时惊喜。

```rust
let ok = Result::Ok::<i32, &'static str>(123);
assert(ok.is_ok(), "is_ok");
assert_eq(ok.unwrap(), 123, "unwrap");

let err = Result::Err::<i32, &'static str>("boom");
assert(err.is_err(), "is_err");
```

| 方法 | 作用 |
|:-----|:-----|
| `is_ok()` / `is_err()` | 判断 |
| `unwrap()` | 取值，失败则 panic |
| `unwrap_or(v)` | 取值，失败用 `v` |
| `map(f)` | 成功时变换值 |
| `map_err(f)` | 失败时变换错误 |

## `?` 运算符

手写 `match` 在一连串可能失败的调用中会迅速变得冗长。`?` 让传播变成一个运算符：

```rust
fn process(path: &str) -> Result<Data, Error> {
    let file = File::open(path)?;          // Err 时直接 return Err(file)
    let text = file.read_to_string()?;     // Err 时直接 return Err(text)
    let data = parse(&text)?;
    return Result::Ok(data);
}
```

`?` 的语义是：

- 值为 `Ok(v)` → 表达式取值为 `v`，继续往下走；
- 值为 `Err(e)` → **立即**从当前函数返回 `Err(e)`，必要时做类型转换。

`?` 在返回 `Option<T>` 的函数里同样有效，只是把 `Err` 换成 `None`：

```rust
fn first_word(s: &str) -> &str {
    let pos = find_byte(s.as_bytes(), b' ')?;
    return &s[0..pos];
}
```

类型可自动转换时，错误会被顺带包装：

```rust
fn inner() -> Result<Data, ParseError> { return Result::Ok(d); }

// 外层返回 IoError，ParseError 自动包装
fn outer() -> Result<Data, IoError> {
    let data = inner()?;      // ✅ 自动转换
    return Result::Ok(data);
}
```

## 补充上下文

裸的错误信息往往不够 —— 你需要知道**在哪一步**失败：

```rust
use error::with_context;

fn load() -> Result<App, Error> {
    let config = read_config("app.conf").with_context("读取配置文件")?;
    let db     = connect(&config).with_context("连接数据库")?;
    return Result::Ok(App::new(config, db));
}
```

最终报告会像这样：

```
读取配置文件失败: 打开 app.conf 失败: 没有那个文件或目录
```

`with_context` 返回 `WithContext<E>`，它同样实现 `Error` trait，因此可以继续叠加。
上下文是**延迟**求值的 —— 只有真正出错时才格式化，成功路径零开销。

## 自定义错误类型

实现 `std::error::Error` trait 就能接入这套机制：

```rust
use error::Error;

pub struct SimpleError {
    pub code: i32,
    pub message: String,
}

impl Error for SimpleError {
    fn kind(&self) -> i32 { return self.code; }
    fn message(self) -> &str { return &self.message; }
}
```

标准库自带两种：`SimpleError`（带错误码与消息）与 `RuntimeError`（运行时错误）。

## 断言

对于「调用者不可能合理处理」的情况（编程错误、违反前置条件），用断言：

```rust
use core::{assert, assert_eq};

assert(count >= 0, "计数不能为负");
assert_eq(actual, expected, "求和不匹配");
```

`std::error` 还提供了 `debug_assert` 与 `debug_unreachable`，只在调试构建生效。

断言第三个参数是消息，取 `[]const u8` 或 `&'static str`。当前签名是显式的，
没有用宏 —— 这是尚未完成的部分之一。

## 报告

```rust
use error::{report, report_fatal, to_string, Backtrace};

// 打印后继续
report(err);

// 打印回溯并终止
report_fatal(err);

// 拿到可打印的字符串
let s = to_string(err);
```

`Backtrace` 结构在 `std/error.zr` 里，记录调用链。

## 完整示例

```rust
use io::{println, eprintln};
use core::{Result, Option, assert};
use error::{with_context, report_fatal, SimpleError};

fn read_config(path: &str) -> Result<String, SimpleError> {
    if path.len == 0 {
        return Result::Err(SimpleError { code: 1, message: String::from_bytes("空路径") });
    }
    return Result::Ok(String::from_bytes("{}"));
}

fn load(path: &str) -> Result<String, SimpleError> {
    let raw = read_config(path)?;                       // 出错即返回
    let parsed = validate(&raw).with_context("校验配置")?;
    return Result::Ok(parsed);
}

fn validate(raw: &String) -> Result<String, SimpleError> {
    if raw.len() == 0 {
        return Result::Err(SimpleError { code: 2, message: String::from_bytes("配置为空") });
    }
    return Result::Ok(raw.clone());
}

fn main() -> i32 {
    match load("app.conf") {
        Result::Ok(cfg)  => println(cfg.as_bytes()),
        Result::Err(err) => {
            eprintln(error::to_string(err).as_bytes());
            return 1;
        }
    }
    return 0;
}
```

## 小结

| 场景 | 用什么 |
|:-----|:-------|
| 可预期的失败，有原因 | `Result<T, E>` + `?` |
| 可能没有值，无原因 | `Option<T>` + `?` |
| 多来源择一 | `or_else` / `map` / `unwrap_or` |
| 附带上下文 | `with_context(err, ctx)` |
| 无法继续的致命错误 | `panic` / `report_fatal` |
| 编程错误（bug） | `assert` / `assert_eq` |

设计取舍：[2. 所有权系统](/learn/02-ownership/) 让「谁负责恢复」在类型层面就清楚了
—— 函数签名里有没有 `Result` 就是答案。

下一章：[7. 泛型、Trait 与生命周期](/learn/07-generics/)。