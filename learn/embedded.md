---
title: 嵌入式与交叉编译
description: 用 zr 编译 WebAssembly、树莓派、STM32 与 RISC-V 固件，以及通过 extern "C" 与 C 库互操作。
sidebar: learn
prev:
  title: comptime 编译期求值
  url: /learn/comptime/
next:
  title: 回到学习首页
  url: /learn/
---

zr 编译器自带代码生成后端，不依赖 LLVM。交叉编译时它直接产出目标平台的
容器格式，交给平台链接器（或直接烧录工具）完成最后一步。

## 交叉编译

```bash
# Linux
zr app.zr --target x86_64-unknown-linux-gnu -o app
zr app.zr --target aarch64-unknown-linux-gnu -o app-arm64

# macOS
zr app.zr --target x86_64-apple-darwin   -o app-x64
zr app.zr --target aarch64-apple-darwin  -o app-arm64

# Windows
zr app.zr --target x86_64-pc-windows-msvc -o app.exe
zr app.zr --target aarch64-pc-windows-msvc -o app-arm64.exe

# WebAssembly
zr app.zr --target wasm32-unknown-unknown -o app.wasm
zr app.zr --target wasm32-unknown-unknown --wat -o app.wat  # 人类可读
zr app.zr --target wasm32-wasi            -o app.wasm
```

完整的平台矩阵见 [支持的目标平台](/tools/targets/)。

## 裸机目标

裸机（bare-metal）目标直接产出可烧录的 ELF 映像，不需要链接器：

```bash
# ARM Cortex-M / ARM32
zr firmware.zr --target arm-none-eabi -o firmware.elf

# RISC-V
zr firmware.zr --target riscv32-unknown-none -o firmware.elf
zr firmware.zr --target riscv64-unknown-none -o firmware.elf
```

裸机镜像有两个与普通 ELF 不同的约定：

- **没有 Program Header** —— `e_entry` 直接指向 `_start`，节地址从 `0x08000000`
  （Cortex-M 向量表）起算。烧录工具与仿真器按节加载即可。
- **没有「退出进程」** —— `_start` 调用 `main` 之后停在自循环，由调试器或复位接管。
  调试输出走 semihosting。

### 一个最小的裸机程序

```rust
// firmware.zr
extern "C" {
    fn semihost_write(regs: *const u32) -> i32;
}

fn helloworld() -> i32 {
    let payload = "Hello from zr!\n";
    var args = [0x08u32, 0x00u32, 0x00u32, 0x00u32];  // SYS_WRITE0
    let ptr = payload as *const u32;
    args[1] = ptr[0];                                 // 字符串首地址
    semihost_write(&args as *const u32);
    return 0;
}

fn main() -> i32 {
    return helloworld();
}
```

```bash
zr firmware.zr --target arm-none-eabi -c -o firmware.o
arm-none-eabi-gcc firmware.o -o firmware.elf -T linker.ld
```

> ARM 使用 A32 编码（暂不支持 `thumbv7em-*`，会被显式拒绝），除法走 `sdiv` / `mls`，
> 因此需要 ARMv7-R/A（M 核没有硬件除法）。RISC-V 没有条件执行，比较结果要用
> `seqz` / `slt` 显式物化，常量用 `lui` + `addi` 拼装。

## WebAssembly

`wasm32` 目标用栈式字节码后端，运行时能力通过模块导入（`zr.*`）提供：

```bash
zr app.zr --target wasm32-unknown-unknown --wat -o app.wat
```

`--wat` 输出 WebAssembly 文本格式，方便阅读与调试。二进制接口与
`wasm32-unknown-unknown` 一致；`-c` 与链接等价（wasm 没有可重定位对象格式）。

## 与 C 互操作

### 链接 C 库

```bash
zr build app.zr -lc -lm -o app
```

### 直接声明 C 函数

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

### C 兼容布局

跨越 FFI 边界时，布局必须精确：

```rust
#[repr(C)]
pub struct Point {
    x: f64,
    y: f64,
}

#[repr(C, packed)]
pub struct Header {
    magic: u32,
    flags: u8,
    length: u32,
}
```

### 回调

```rust
extern "C" fn callback(data: *mut void) -> i32 {
    unsafe {
        *(data as *mut i32) = 1;
    }
    return 0;
}
```

注意回调签名必须是 `extern "C"`，否则符号修饰不符合 C ABI。

## 链接模型

```bash
# 静态链接（默认）
zr build app.zr -o app

# 分步：先产出目标文件，再统一链接
zr build main.zr -c -o main.o
zr build lib.zr  -c -o lib.o
zr link main.o lib.o -lc -lm -o app
```

三种原生容器（ELF / Mach-O / PE-COFF）产出的 `.o` 都可以直接交给平台链接器。
wasm 没有可重定位对象格式，`-c` 与链接等价。

## 下一步

- 完整目标矩阵与运行时说明 → [支持的目标平台](/tools/targets/)
- 命令行全部选项 → [命令行参考](/tools/cli/)