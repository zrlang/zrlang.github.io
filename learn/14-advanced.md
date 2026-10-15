---
title: 14. 高级特性
description: unsafe 与裸指针、内联汇编、高级 trait、宏系统、comptime 编译期求值、跨平台与 C 互操作。
sidebar: learn
status: planned
status_note: 仅 <code>asm!</code> / <code>intrinsic!</code> 能解析，代码生成尚未实现。
prev:
  title: 13. 模式匹配
  url: /learn/13-patterns/
next:
  title: 回到教程概览
  url: /learn/
---

最后一章把「需要向底层走」的那些特性放在一起：它们都是**用显式的方式换取
性能或互操作**，代价是要自己承担正确性。

> **⚠️ 当前状态**：本��章的多数特性尚未实现 —— 只有 `asm!` / `intrinsic!`
> 能被解析，代码生成未落地。

## `unsafe`

`unsafe` 是 zr 里唯一的安全豁免面，而且它**只关闭借用检查器**：

- 类型检查仍然生效；
- 生命周期检查仍然生效；
- 模式穷尽性检查仍然生效。

```rust
unsafe {
    let p = 0x1000 as *mut u8;
    *p = 42;              // 危险操作，安全责任在你
}
```

这比「关掉所有检查」小得多 —— 类型搞错、生命周期搞错依然会被编译器拦住。

需要 `unsafe` 的操作：

| 操作 | 为什么 |
|:-----|:-------|
| 解引用裸指针 | 编译器无法验证地址有效性 |
| 调用 `unsafe fn` | 函数签名本身就在声明契约 |
| 访问可变静态变量 | 可能与其他线程/协程竞争 |
| 实现 `unsafe` trait | 编译器无法验证类型约定 |

### 裸指针

| 类型 | 语义 |
|:-----|:-----|
| `*const T` | 不可变裸指针 |
| `*mut T` | 可变裸指针 |

```rust
let p = 0x1000 as *mut u8;
let q = p as *const u8;         // 可变 → 不可变是安全的

let n = offset(p, 4);           // 按元素偏移
let ok = !is_null(p);            // 空指针检查
```

`std/mem.zr` 里的内存原语：

```rust
memset(dst, value, count);
memcpy(dst, src, count);        // 不允许重叠
memmove(dst, src, count);       // 允许重叠
memcmp(a, b, count);
memswap(a, b);
```

## 内联汇编

`asm!` 语法已经能解析（`future/codegen/inline_asm.md` 标记为已完成设计）：

```rust
asm! {
    "mov {0}, {1}",
    in(reg) value,
    lateout(reg) result,
}
```

代码生成尚未实现，因此当前无法编译。

## 高级 trait

### 关联类型

```rust
pub trait Mappable {
    type Item;
    type Output;
    fn map<F>(self, f: F) -> Self::Output
    where F: Fn(Self::Item) -> Self::Output;
}
```

关联类型投影（`<T as Tr>::Item`）的设计文档在 `future/trait_system/assoc_type_projection.md`。

### 默认泛型参数

```rust
trait Summary {
    fn summarize(self) -> String;
}
```

zr 的设计文档里有 `impl Trait`（RPIT 与 APIT）、HRTB（`for<'a>`）、
特化、孤立规则、负 trait bound，都放在 `future/trait_system/`。
这些目前都还是设计，没有实现。

### Auto trait

`Send`、`Sync`、`Unpin`、`Sized` 被类型检查器特判为**内建 auto trait**
（`auto + marker`），自动对满足条件的类型成立，不需要手写 `impl`。
`#[marker]` 可以把自定义 trait 也标记成 marker trait。

## 宏系统

### 声明宏

`macro_rules!` 能被解析（`src/parser/mod.rs` 有专门的解析分支）：

```rust
macro_rules! square {
    ($x:expr) => { $x * $x };
}
```

设计文档：`future/misc/macro_system.rs`（`macro_rules!` + 过程宏）。

### 内建宏

| 宏 | 作用 |
|:----|:-----|
| `asm!` | 内联汇编 |
| `intrinsic!` | 编译器内建（如 `sizeof`、内存屏障） |

**当前没有 `format!` / `vec!` / `println!` 这类格式化或构造宏**。
格式化输出走 `io::print_fmt`：

```rust
use io::{print_fmt, FormatArg};

print_fmt("{} + {} = {}\n", &[
    FormatArg::Int(40), FormatArg::Int(2), FormatArg::Int(42)
]);
```

## `comptime` 编译期求值

`comptime` 让**被允许的 zr 代码在编译期执行**，结果固化进产物。

```rust
comptime fn fact(n: i32) -> i32 {
    if n <= 1 { 1 } else { n * fact(n - 1) }
}

const SIZE: usize = fact(5);   // 编译期求值为 120
```

### 类型反射

`@typeInfo(T)` 在编译期返回描述类型结构的值，可以 `match`：

```rust
fn make_default<T>() -> T {
    comptime match @typeInfo(T) {
        .Struct  => T::default(),
        .Int     => 0 as T,
        .Pointer => null,
        else     => unreachable(),
    }
}
```

### `comptime` vs `const fn`

| | `const fn` | `comptime` |
|:--|:-----------|:-----------|
| 读类型信息 | ✘ | ✔ |
| `match` 类型结构 | ✘ | ✔ |
| 构建编译期容器 | ✘ | ✔ |
| 面向 | 编译期常量 | 元编程 |

### 三条硬约束

`comptime` 不能做的事：

- **不能有副作用** —— 不写文件、不发起 I/O、不读环境变量。编译必须是纯函数。
- **不能无限循环** —— 递归深度与迭代次数有硬上限。
- **不能依赖运行期状态** —— 所以「用 comptime 读配置文件」是刻意不支持的，
  配置应该在 `zr` 命令行上以生成代码的方式传入。

`comptime` 的完整实现排在 v0.6.0。

## SIMD

`std/simd.zr` 提供了可移植的向量类型：

```rust
use simd::{f32x4, i32x4, f64x2, i8x8};

let a = f32x4::from_array([1.0, 2.0, 3.0, 4.0]);
let b = f32x4::from_array([5.0, 6.0, 7.0, 8.0]);
let c = (a + b).to_array();
```

配合 `#[repr(simd)]` 可以要求向量布局。设计文档在 `future/misc/simd.md`。

## 内存布局控制

跨 FFI 或写二进制协议时，布局必须精确：

```rust
#[repr(C)]              // C 兼容：按声明顺序紧密排列
pub struct Packet {
    magic:  u32,
    length: u32,
}

#[repr(C, packed)]      // 去掉尾部填充
pub struct Header {
    magic:  u32,
    flags:  u8,
    length: u32,
}

#[repr(transparent)]    // 布局等同于唯一的非零大小字段
pub struct Handle(usize);

#[repr(u8)]             // 枚举判别值占 1 字节
pub enum Status {
    Pending = 0,
    Running = 1,
    Done    = 2,
}
```

这四个 `repr` 在 zr 的类型检查器里是**真正参与布局计算的**，不是装饰。

## C 互操作

### 声明 C 函数

```rust
extern "C" {
    fn printf(fmt: *const u8, ...) -> i32;
    fn strlen(s: *const u8) -> usize;
    fn memcpy(dst: *mut u8, src: *const u8, n: usize) -> *mut u8;
}

fn greet(name: &str) -> i32 {
    return printf("hello, %s\n" as *const u8, name as *const u8);
}
```

### 链接 C 库

```bash
# 先用 zr 产出目标文件，再用平台链接器链接 C 库与 zr 运行时
zr main.zr -c -o main.o
cc main.o -lc -lm target/release/build/zr-*/out/libzrrt-macos_x86_64.a -o app
```

`zr link` 子命令尚未实现，详见[命令行参考](/tools/cli/)。

### 回调

```rust
extern "C" fn callback(data: *mut void) -> i32 {
    unsafe {
        *(data as *mut i32) = 1;
    }
    return 0;
}
```

回调签名必须标 `extern "C"`，否则符号修饰不符合 C ABI。

### 裸机目标

zr 的编译器自带后端，交叉编译只需要 C 工具链（甚至连链接器都不需要）：

```bash
# WebAssembly（人类可读）
zr app.zr --target wasm32-unknown-unknown --wat -o app.wat

# 裸机，直接产出可烧录映像
zr firmware.zr --target arm-none-eabi        -o firmware.elf
zr firmware.zr --target riscv64-unknown-none -o firmware.elf
```

裸机镜像的两个特殊之处：

- **没有 Program Header** —— `e_entry` 直接指向 `_start`，节地址从 `0x08000000`
  （Cortex-M 向量表）起算，烧录工具按节加载即可。
- **没有「退出进程」** —— `_start` 调用 `main` 之后停在自循环，
  调试输出走 semihosting。

架构约束：ARM 用 A32 编码（`thumbv7em-*` 会被显式拒绝），除法走 `sdiv` / `mls`，
需要 ARMv7-R/A（M 核没有硬件除法）；RISC-V 没有条件执行，比较结果要用
`seqz` / `slt` 显式物化。

完整的 11 个目标矩阵见[支持的目标平台](/tools/targets/)，
流水线细节见[编译器架构](/tools/architecture/)。

## 编译期求值的运行时环境

编译器侧：

```bash
zr program.zr --dump-ast        # 看每一步在做什么
zr program.zr --dump-mir        # 控制流脱糖后
zr program.zr --dump-ssa        # φ 节点插入后
zr program.zr --dump-asm        # 最终机器码
```

这些 dump 同时是最好的学习材料 —— [9. 函数式编程特性](/learn/09-functional/)
里的 `map` 在 MIR 和 SSA 里长什么样，`dump` 一下就知道。

## 小结

| 特性 | zr 现状 |
|:-----|:---------|
| `unsafe` 与裸指针 | 设计完成 |
| `memcpy` / `memmove` / `transmute` | ✔ `std/mem.zr` |
| `#[repr(C)]` / `packed` / `transparent` / `simd` | ✔ 真正参与布局 |
| `extern "C"` 与 C 链接 | ✔ |
| SIMD 类型 | ✔ `std/simd.zr` |
| `asm!` / `intrinsic!` | 能解析，代码生成未实现 |
| `macro_rules!` | 能解析 |
| 格式化宏（`format!`） | ✘ 用 `io::print_fmt` |
| 关联类型投影 / HRTB / 特化 / 负 bound | 设计文档已写 |
| `comptime` | v0.6.0 |
| 裸机 / wasm 目标 | ✔ 见[目标平台](/tools/targets/) |

---

教程到此结束。回到[教程概览](/learn/)看整体进度，或读[路线图](/community/roadmap/)
看这些特性分别在哪个版本落地。