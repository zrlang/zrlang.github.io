---
title: 错误处理
description: zr 用 Result 与 ? 运算符表达错误：错误是值，传播是运算符，不存在异常。
sidebar: learn
prev:
  title: 类型与 trait
  url: /learn/types/
next:
  title: 异步与协程
  url: /learn/async/
---

zr 没有异常。所有可能失败的函数都在**返回类型**里声明这一点 ——
调用点一眼就能看出这个函数会不会失败。

## `Result`

```rust
pub fn parse(s: &str) -> Result<i32, ParseError> {
    // ...
}
```

`Result<T, E>` 是标准库里的枚举：

```rust
pub enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

因为它是枚举，[类型与 trait](/learn/types/) 里的穷尽性检查同样适用：

```rust
let parsed = parse(input);
return match parsed {
    Result::Ok(v)  => v,
    Result::Err(e) => report(e),
};
```

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

- 值为 `Ok(v)` → 表达式取值为 `v`，继续往下走。
- 值为 `Err(e)` → **立即**从当前函数返回 `Err(e)`，并在必要时做类型转换。

`?` 出现在返回 `Result<T, E>` 的函数里就返回 `Err`；出现在返回 `Option<T>` 的函数里就返回 `None`。
类型可自动转换时，错误也会被顺带转换：

```rust
fn inner() -> Result<Data, ParseError> { /* ... */ }

// 外层返回 IoError，ParseError 自动包装成 IoError
fn outer() -> Result<Data, IoError> {
    let data = inner()?;      // ✅ 自动从 ParseError 转换
    return Result::Ok(data);
}
```

## 补充上下文

裸的错误信息往往不够 —— 你需要知道**在哪一步**失败：

```rust
fn load() -> Result<App, Error> {
    let config = read_config("app.conf").context("读取配置文件")?;
    let db     = connect(&config).context("连接数据库")?;
    let schema = load_schema(&db).context("加载表结构")?;
    return Result::Ok(App::new(config, db, schema));
}
```

最终报告会是：

```
读取配置文���失败: 打开 app.conf 失败: 没有那个文件或目录
```

上下文是**延迟**求值的 —— 只有在真正出错时才格式化，因此成功路径零开销。

## 组合子

处理「多个来源、挑一个成功」这类问题时，组合子比嵌套 `match` 清晰得多：

```rust
// 任一成功即返回；全部失败才失败
let cfg = read_from_env().or_else(|_| read_from_file("app.conf"))?;

// 默认值
let value = parse(input).map(|v| v * 2).unwrap_or(0);

// 先转换再取默认
let port = lookup("PORT").map(parse_int).unwrap_or(8080);

// 检查前提
ensure!(!path.is_empty(), "路径不能为空");
```

## `Option`

对于「可能没有值、但没有失败原因」的场景，用 `Option` 而不是伪造一个错误：

```rust
fn find_byte(bytes: []const u8, target: u8) -> Option<usize> {
    var i = 0;
    while i < bytes.len {
        if bytes[i] == target { return Option::Some(i); }
        i += 1;
    }
    return Option::None;
}
```

`?` 在返回 `Option` 的函数里同样有效，只是把 `Err` 换成 `None`：

```rust
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    let pos = find_byte(bytes, b' ')?;    // 没找到就返回 None
    return &s[0..pos];
}
```

## 什么时候不该用 `Result`

- **不可避免地无法继续**（进程启动失败、OOM）→ `panic`，并用 `report_fatal` 给出回溯。
- **调用者不可能合理处理**（编程错误、违反前置条件）→ 断言 `assert!` / `assert_eq!`。

zr 的立场是：**常规错误是数据，只有 bug 才是控制流**。

```rust
use error::{assert, assert_eq, report_fatal, Backtrace};

fn main() -> i32 {
    let v = Vec::new();
    assert!(v.len() >= 0);                  // 不会失败
    let first = v.get(0);                   // 返回 Option，不是 Result
    match first {
        Option::Some(x) => use_value(x),
        Option::None    => {},              // 空 Vec 是合法状态
    }
    return 0;
}
```

## 与 panic 的关系

`panic` 同样在编译期被检查：`std::core::panic` 要求函数返回 `!`（永不返回）类型，
所以它可以出现在任何位置而不影响控制流分析。panic 会展开调用栈并终止进程；
如果开启了回溯支持，`std::error::Backtrace` 会给出定位信息。

## 小结

| 场景 | 用什么 |
|:-----|:-------|
| 可预期的失败，有原因 | `Result<T, E>` + `?` |
| 可能没有值，无原因 | `Option<T>` + `?` |
| 多来源择一 | `or_else` / `map` / `unwrap_or` |
| 附带上下文 | `.context("...")` |
| 无法继续的致命错误 | `panic` / `report_fatal` |
| 编程错误（bug） | `assert!` / `assert_eq!` |

## 下一步

- 协程与并发 → [异步与协程](/learn/async/)
- 错误类型所在的模块 → [标准库](/std/)