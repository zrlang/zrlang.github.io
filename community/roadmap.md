---
title: 项目进展
description: zr 的开发进度——已交付的能力、正在做的事、已知边界，以及每一项的阻塞原因。
sidebar: community_sidebar
prev:
  title: 社区
  url: /community/
next:
  title: 贡献指南
  url: /community/contributing/
---

zr 目前是 **v0.8.0**：里程碑 v0.5.0、v0.6.0、v0.7.0、v0.8.0 均已全部完成，
v0.9.0（修复 + 文档对齐）也已交付，正在向 v1.0.0 推进（当前在 `feat/lang-features`
分支上做类型系统：关联类型投影、`impl Trait`、`const` 泛型、trait 默认方法等）。

本页的状态来自 zr 仓库的 `README.md`、`tests/README.md` 与 `AGENTS.md`，不是估计值。
语言测试按《Rust 程序设计语言》的章节顺序组织，所以「能不能跑」
有一条明确的、不含糊的判据：**它有没有对应的测试用例，且用例通过。**

## 一句话现状

| 维度 | 现状 |
|:-----|:-----|
| 已完成的里程碑 | v0.5.0（编译流水线 + 11 个目标）✅、v0.6.0（`comptime` / 属性系统 / SSA φ / 寄存器分配 / 浮点 / 优化 pass）✅、v0.7.0（AArch64 浮点、`.rodata` 字符串、`extern "C"`、指针与内存模型、ARM32 / RISC-V / wasm 指针访问）✅、v0.8.0（`match` 全模式、枚举与 `Drop`、函数指针、受限异步、`#[derive]`、宏、线程、`i128`）✅、v0.9.0（回归修复 + 文档对齐 + 负向测试框架）✅ |
| 正在进行 | v1.0.0（API 稳定、完整异步运行时、自举、性能基准达标）🚧 —— 当前在类型系统（关联类型 / APIT / const 泛型 / trait 默认方法） |
| 语言测试覆盖 | **125 个**正用例 × 5 个优化等级 = 625 项；**37 个**负向用例；267 项单元测试 |
| 真正能写出来的程序 | 变量、标量与浮点、函数与递归、全部循环（含 `for`）、`if`/`else` 作为表达式、`match` 全模式、`comptime`、`as` 转换、指针与 `.rodata` 字符串、结构体与枚举、`union`、`impl` 方法与 `Drop`、函数指针、泛型/trait/关联类型、`impl Trait`、`const` 泛型、闭包（含转 `fn` 值）、`async`/`await`/`spawn`/`yield`、`Vec`/`String`/切片、`Result` 与 `?`、`#[derive]`、`macro_rules!`、线程与文件系统 |
| 还不能写 | `Box`/`Rc`/`RefCell` 智能指针、`HashMap`/`HashSet`、trait 对象（`dyn`）的 vtable 分派、`panic!` 宏、迭代器组合子、完整借用检查（当前最小切片 + NLL 近似）、生命周期检查（标注解析后丢弃）、proc-macro |
| 跨平台 | 11 个目标三元组；浮点与指针在 x86-64、AArch64、ARM32、RISC-V、wasm 上均已落地 |

## 里程碑

### v0.5.0 ✅

打通从源码到可烧录固件的完整链路。

- 完整前端：生成器驱动的词法分析器、递归下降 + Pratt 解析器、
  HIR + Hindley-Milner 类型推导、trait 约束求解、NLL 借用检查框架、模式穷尽性检查。
- 完整中端：MIR、控制流脱糖、λ 提升、SSA 构造。
- 完整后端：树覆盖指令选择、线性扫描寄存器分配、栈帧布局、机器码发射，
  覆盖 x86-64 / AArch64 / ARM32 / RISC-V 32 / RISC-V 64。
- 容器输出：ELF32 / ELF64 / Mach-O / PE-COFF / wasm。
- 11 个目标三元组；标准库 core / io / string / collections / async / error / net / simd。

### v0.6.0 ✅

把「框架完整」变成「真能用」。这一轮的内容密度比 v0.5.0 高得多：

**`comptime` 编译期求值**

- [x] `comptime fn`：递归、编译期循环、`break`、复合赋值
- [x] `const` 右值内联（`const SIZE: i32 = fact(5)`）
- [x] **终止性双闸**：递归深度上限 + 求值步数预算。写一个不收敛的编译期循环
      会让编译**报错退出**，而不是挂住
- [x] 结构体字面量与字段访问（构造、读字段、编译期改写 `p.x = v`）

**属性系统**

- [x] `#[inline(always)]` / `#[inline(never)]` 驱动内联决策
- [x] `#[repr(C)]` / `#[repr(uN)]` / `#[repr(packed)]` 布局
- [x] `#[link(name, kind)]` 传递给链接器
- [x] `#[cfg(...)]` 条件编译、`#[allow]` / `#[deny]` lint 级别
- [x] `#[derive(...)]` 生成默认 impl、`#[deprecated]` 使用警告
- [x] `#[test]` 测试桩

**SSA 构造 —— 这是解开循环的钥匙**

- [x] 迭代支配边界插 φ（Braun et al.）+ DFS 重命名
- [x] 循环头的隐式合流、**循环出口的合流（`break` 路径）**
- [x] 关键边拆分，使 φ 的并行拷贝按边发射

**寄存器分配**

- [x] CFG 活跃性分析 + 线性扫描 + 栈溢出
- [x] 回边活跃区间延长；跨调用存活的值限定 callee-save
- [x] 溢出路径覆盖除法 / 取模 / 移位 / 比较的每一个操作数位置

**浮点（x86-64 + AArch64）**

- [x] f64 指令选择（SSE2）：常量、算术、取负（`xorpd` 翻符号位）、
      比较（`ucomisd` + `setnp`，NaN 语义符合 IEEE754）、`cvtsi2sd` / `cvttsd2si`
- [x] f32 指令选择（`movss` / `addss` …；常量携带位宽 `Float(bits, width)`）
- [x] AArch64：`fadd`/`fsub`/`fmul`/`fdiv`、`fcmp` + `cset`、`fneg`、
      `scvtf`/`ucvtf`/`fcvtzs`/`fcvt`
- [x] 浮点走专用栈槽 + XMM/`d0`/`d1` 暂存，不占用整数寄存器分配器
- [x] 浮点实参/返回值按 ABI 走 `xmm0`-`xmm7`（x86-64）/ `v0`-`v7`（AArch64），
      与整数实参分别计数
- [x] 顺带修掉若干 AArch64 bug：`b.cond` 偏移量、零判定、`fneg` 基址、
      移位基址、`as` 转换（SBFM/UBFM）、取模分配
- [x] AArch64 callee-save 寄存器（`x19`-`x28`）：跨调用存活的值不再被覆盖
- [x] 修复 x86-64 `emit_param_moves`：形参搬运改回并行拷贝
      （顺序搬运会踩掉尚未读取的源）

**优化 pass 完整化**

- [x] 常量折叠（整数 + 浮点 + 类型转换）
- [x] SCCP 稀疏条件常量传播（含恒定分支折叠）
- [x] 死代码消除、死块消除（删块后重编号）
- [x] 块内 CSE 与全局值编号（覆盖 `Cast` / `Copy`）
- [x] 窥孔优化、循环不变量外提、单块函数内联

**其他**

- [x] 字面量类型后缀贯通（`42u64` / `255u8` / `7usize` / `3.14f32` / `2.0f64`），
      词法层就拒绝后缀与字面量不符的组合
- [x] 编译确定性：块号与 φ 编号不再依赖 `HashMap` 遍历顺序
- [x] 浮点类型贯通：`Binary` / `Call` 携带结果类型，后端据此选 GPR 还是 XMM 指令

### v0.7.0 ✅

**已完成**

- [x] x86-64 f32 支持（常量携带位宽，走 `ss` 指令）
- [x] AArch64 f32/f64 指令选择（见上）
- [x] 字符串字面量落到 `.rodata`：去重、NUL 结尾、取址即取指针。
      x86-64 用 `lea reg,[rip+disp]`（`R_X86_64_PC32`），AArch64 用 `adrp`+`add :lo12:`
- [x] `.rodata` 段归属：ELF 段索引 2、Mach-O `n_sect=2`、COFF 节号 2
- [x] `extern "C"` 声明接通运行时（`zr_write` / `zr_read` / `zr_exit`）：
      外部函数并入函数表，参与类型检查与名称解析，调用点发未定义符号给平台链接器
- [x] 指针 / 字符串的取址、解引用与索引（最小 SSA 内存模型）：
      新指令 `Load` / `Store` / `SlotAddr`，按位宽区分有无符号
- [x] `&x` 取局部变量地址：被取地址的量固定到栈槽，读写变成显式 `Load` / `Store`
- [x] `*p` / `*p = v` / `p[i]` / `p[i] = v`，索引按元素字节大小缩放
- [x] `s[i]` 字符串按字节索引，结果为 `u8`
- [x] 指针算术：`p + n` / `n + p` / `p - n` 按 pointee 大小缩放，
      `p - q` 得到元素个数（isize）；**两个指针相加显式报错**
- [x] 浮点值的取址 / 解引用显式报错（后端不支持，避免「能编过但算错」）
- [x] 解析修复：块状表达式不再作为二元运算的左侧
      （否则 `if c { }` 后跟 `*p = v` 会被误解析为乘法）
- [x] ARM32 / RISC-V / wasm 后端的浮点指令选择
- [x] ARM32 / RISC-V / wasm 后端对指针 / 内存访问与字符串字面量取址
- [x] 32 位目标的多字长算术（寄存器对）
- [x] `str` 的真正切片表示（ptr+len）：目前 `s[i]` 无边界检查，越界是 UB
- [x] 字符串字面量落 `.rodata`、去重、按地址比较
- [x] 指针算术与字符串按字节索引

### v0.8.0 ✅

- [x] `match` 运行期语义（脱糖成 if/else 链，首匹配胜出）
  - [x] 字面量（含负数）、`_`、绑定臂、或模式、guard
  - [x] 结构体模式（`..` 尾、嵌套）、元组模式、范围模式、枚举变体模式
  - [x] 穷尽性在编译期强制；缺臂报错区分场景（枚举列出缺失变体名）
  - [x] 运行期结构体：具名字段构造、字段读写、嵌套、`impl` 方法与关联函数
  - [x] 元组结构体、结构体更新 `..base`
  - [x] 枚举：变体构造、显式判别式、拷贝语义
  - [x] 用户 `Drop` trait：作用域/返回/循环析构、部分移动、Drop 数组按值返回
- [x] `for` 范围循环与数组遍历（`44_for_range` / `45_for_array`）
- [x] `if let` / `while let` / `let ... else` / 带标签循环
- [x] 一等函数指针（x86-64）：取址、参数/返回值/字段/数组、运行期间接调用
- [x] 受限异步降级（Rust 风格 `async fn`/`poll` 模型）
  - [x] `.await`（仅限 `async fn`）、`async fn main`、future 别名与返回点释放
  - [x] 挂起 future 的递归 Drop、`spawn(f)` 任务队列
- [x] `#[derive]` 生成真实方法体（`PartialEq`/`Eq`/`Hash`/`PartialOrd`/`Ord`/`Default`/`Debug`/`Clone`/`Copy`）
- [x] `macro_rules!` 宏展开与调用
- [x] 线程（`spawn`/`join`、共享数据）、进程、文件系统与路径
- [x] `i128` / `u128`（x86-64）：加减、位运算、移位、乘除取模
- [x] 字面量类型后缀贯通、`str` 真正切片表示（ptr+len）
- [x] 内联汇编（x86-64）与定长数组 / 自动向量化（SSE/SSE2）

### v0.9.0 ✅（修复 + 文档对齐）

- [x] `if let` / `#[derive]` 回归修复
- [x] `subtype().ok()` 静默吞错：关键路径不再吞
- [x] `#[derive]` 生成真实方法体（不再只登记标记）
- [x] 负向测试框架 `tests/negative/` + `tests/zr_negative.rs`（`// expect:` 子串约定）
- [x] turbofish 三种落点补齐
- [x] `docs/`、`AGENTS.md`、`tests/README.md` 与源码对齐

### v1.0.0 🎯 目标（在途）

当前在 `feat/lang-features` 分支上，已落地的类型系统工作：

- [x] 生命周期参数 / 实参（`Foo<'a>` / `&'a mut T` / `&'static dyn T`）——解析与全链路跑通，标注本身仍被类型检查丢弃
- [x] 泛型关联类型投影 `F::Output` / `Self::Output` / `<T as Trait>::Item`（限定路径带 trait 校验）
- [x] `impl Trait` 参数位置（APIT）脱糖成匿名泛型参数
- [x] `const` 泛型 `<const N: usize>`
- [x] `union` 构造与字段访问（类型双关）
- [x] trait 默认方法 / `default fn` 合成到 impl
- [x] `yield` 协作让出点（async fn 内）
- [x] 带捕获闭包转裸 `fn(..)` 值（函数值 = `{code, env}` 记录 + 统一 shim ABI）
- [x] 调用实参 / 字段值的类型核验（`std/error` 因此可加载）
- [ ] API 稳定
- [ ] 完整的异步运行时（`std::async` 通道、`join`/`race`、唤醒式执行器）
- [ ] **自举** —— 用 zr 重写 zr 编译器
- [ ] 性能基准达标（接近 Rust）

## 语言测试覆盖

`tests/cases/*.zr` 每个是一个自检程序（全部断言通过时 `main` 返回 `0`，
失败时返回失败断言的编号）。宿主运行器 `tests/zr_language.rs` 会把每个用例
在 `-O0` / `-O1` / `-O2` / `-O3` / `-Oz` 下**各编译并运行一遍** ——
优化 pass 只要有一条改坏语义，用例就会在某个等级上变红。

```bash
cargo test --test zr_language    # 125 用例 × 5 等级 = 625 项
cargo test --test zr_negative    # 37 个负向用例
```

| 领域 | 用例 |
|:-----|:-----|
| 变量、标量、运算符、函数 | `01_variables` … `11_if_else_chain` |
| `comptime` 编译期求值 | `12_comptime`、`16_comptime_fn`、`26_comptime_struct` |
| 类型转换、字面量后缀 | `13_casts`、`21_literal_suffixes`、`67_unsigned_ops`、`68_float_widening` |
| 寄存器溢出 | `14_spill`、`18_spill_ops` |
| 循环控制流 | `15_loops`、`17_loop_break`、`61_labeled_loops`、`97_loop_value` |
| 浮点 | `19_float`、`20_f32`、`53_narrow_float` |
| 模式匹配 | `25_match`、`54_struct_pattern`、`55_tuple_pattern`、`56_range_pattern`、`57_enum`、`52_if_let`、`62_while_let`、`63_let_else`、`80_match_value`、`121_let_destructure` |
| 字符串、指针、内存 | `23_strings`、`24_pointers`、`65_slices`、`95_str_slice_layout`、`96_str_slice_hash` |
| 结构体、枚举、`union` | `33_methods`、`34_tuple_struct`、`35_struct_update`、`37_struct_array`、`57_enum`、`116_enum_default`、`117_union`、`114_enum_ord_derive` |
| `Drop` 与移动 | `30_drop`、`36_drop_array`、`38_drop_temp`、`39_partial_move`、`40_drop_temp_nested`、`41_return_drop_array`、`42_temp_partial_move`、`43_return_drop_struct`、`46_dynamic_index_move`、`87_move_check` |
| `for` 循环 | `44_for_range`、`45_for_array` |
| 异步与协程 | `29_async`、`47_async_return_aggregate`、`48_async_nested_aggregate`、`49_dynamic_future_source`、`50_dynamic_future_aggregate`、`51_spawn`、`123_yield_cooperative` |
| 函数指针与闭包 | `31_fn_ptr`、`32_fn_ptr_async`、`73_closures`、`83_closure_fnptr`、`84_closure_capture_value`、`109_closure_env_cross_fn`、`110_closure_env_generic_passthrough`、`125_closure_to_fn` |
| 泛型 / trait / 关联类型 | `66_generics`、`74_generic_alias`、`91_multi_bound_generics`、`98_generic_infer_usage`、`118_assoc_projection`、`119_qualified_assoc`、`120_apit`、`122_const_generic`、`124_trait_default_methods` |
| `#[derive]` | `71_derive`、`78_derive_methods`、`94_array_field_hash`、`96_str_slice_hash`、`100_debug_derive`、`108_debug_pretty`、`112_fmt_debug`、`114_enum_ord_derive`、`116_enum_default` |
| 错误处理 | `69_question`、`89_prelude_variant` |
| 模块与导入 | `70_type_alias`、`75_use_alias`、`90_glob_import`、`103_inline_mod` |
| 宏、线程、进程、文件系统 | `58_macros`、`59_threads`、`60_process`、`64_fs_path`、`99_fs_tempfile_metadata` |
| 内联汇编、数组、SIMD | `27_inline_asm`、`28_arrays` |
| 借用检查与边界 | `86_bounds_check`、`105_borrow_nll`、`107_string_push_bytes_reserve` |
| 其它 | `72_statics`、`76_ssa_join_phi`、`77_many_args`、`79_zero_const_high_reg`、`81_float_param_forward`、`82_turbofish`、`85_unsafe`、`88_dyn_keyword`、`92_cfg_filter`、`93_mixed_width_tuple`、`101_vec_indexing`、`102_path_question`、`104_socket_runtime`、`111_i128`、`113_i128_muldiv`、`115_lifetime_args` |

完整的逐条清单与负向用例见 zr 仓库的 `tests/README.md`。

## 循环是怎么修好的

`loop` + `break`、`continue`、`while`、`i = i + 1` 写在循环头里的写法，
以及递归，现在在 O0/O1/O2/O3/Oz 下都正确。这一块之前是「能编译但结果不对」，
修掉的根因值得记一笔：

- `break` / `continue` 在 MIR 降级里落进 `_ => Unit` 兜底分支，等价于空操作
  —— `loop { .. break; }` 直接**转不出来**（编译成功，运行挂死）。
- `continue` 在类型检查里被映射成了 `break`，跳出口而不是跳回边。
- 循环头缺 φ：`i = i + 1` 写在循环头里时，`i` 的定义点只有循环头自己 + 入口，
  只统计前驱会漏掉，于是计数器停在入口值。
- 内层循环的累加器 `s` 只在循环体里定义，但跨着整个内层循环活着 ——
  合流点需要 φ 的判据不能只看「前驱里有几处定义」，得看活跃性。
- φ 的 incoming 在寄存器分配里按**定义所在的前驱块末尾**延长，而不是 φ 自己的位置。
  回边上后者在定义之前，算出来的活跃区间会被插入操作覆盖，循环体里刚算出的值
  立刻就「死」了、寄存器被下一条指令复用。

## 已知边界

编译器会在这些情况**明确报错**，而不是给出错误结果：

| 情况 | 行为 |
|:-----|:-----|
| 浮点值的取址 / 解引用 | 报错（后端不支持，避免「能编过但算错」） |
| 两个指针相加 | 报错 |
| Thumb-2 超过 8 个活跃寄存器 | 报 `unsupported_pressure`；栈上传参（≥5 个）同理 |
| 不收敛的编译期循环 | 报错退出（不会挂住编译器） |
| `s[i]` 越界 | **UB** —— 索引不做边界检查（标量下标在类型检查阶段报错） |
| 泛型 / 异步函数当值 | 报错（单态化只发生在具名调用点） |
| 带捕获闭包经 `extern "C"` 传给 C 回调 | 报错（C 侧没有地方放 env） |
| 切片模式在 `let` 位置可反驳 | 报 `refutable pattern`（需 `let ... else`） |

## 还没实现的语言特性

下列章节的用例目前还测不了。列出来是为了让「测试通过」这句话有明确边界，
而不是暗示语言已经可用。

| Rust Book 章节 | 阻塞原因 |
|:----------------|:---------|
| 所有权 / 借用 / 引用 / 切片 | 🟡 部分：最小移动检查（`let b = a` 后读 `a` 报错）与借用检查最小切片（同位置重叠、写/读被借用位置、NLL 按 last-use 近似）已实现；字段级移动、跨函数借用分析、生命周期存活检查未实现（`'a` 标注解析后丢弃） |
| 智能指针（`Box` / `Rc` / `RefCell`） | ❌ 未实现 |
| 集合（`HashMap` / `HashSet`） | ❌ 未实现（`Vec` / `String` 可用，`Vec<(K,V)>` 可做关联列表替代） |
| trait 对象（`dyn` vtable 分派） | 🟡 词法 + 解析 + 类型检查骨架可用；vtable 分派未实现，方法/字段访问报错 |
| `panic!` 宏 | ❌ 未实现（`Option`/`Result`/`?` 已可用） |
| 迭代器组合子 | ❌ 未实现（`Iterator` 只有 `next`；`std/slice.zr` 高阶函数接受函数指针） |
| 完整借用检查 | 🟡 最小切片 + NLL 近似（见上）；`infer.rs::check_borrows` 仍是未接线的空壳 |
| 生命周期检查 | 🟡 标注可解析、全链路跑通，但类型检查仍整体丢弃，无存活/子类型检查 |
| 高级特性 | 🟡 `unsafe` 块可解析并通过类型检查（**不改变语义**）；`macro_rules!` 可用；proc-macro 未接线；`--emit-llvm` 是实验性伪 IR |
| 完整的异步运行时 | 🟡 受限异步降级、`spawn`、`yield` 可用；`std::async` 的通道、`join`/`race` 与唤醒式执行器属于 v1.0 |

## 为什么先做这些

**v0.6 优先后端而非语法。** v0.5 已有 11 个目标，但每个目标的指令选择都有缺口。
循环不终止、寄存器串值这类问题会让**任何**前端特性都无法验证，
所以先把 SSA 构造、活跃性分析、溢出路径修对 —— 这才是能继续往前走的地面。

**边界宁可报错也不猜。** 32 位目标的宽整数、ARM 上的浮点、浮点取址，
全部显式报错而不是静默生成错误的机器码。一个会算错的程序比一个编不过的程序贵得多。

**优化 pass 要在所有等级上被验证。** 用例在 `-O0` 到 `-Oz` 各跑一遍，
就是为了防止「优化把语义改坏」这类最容易漏的回归。

**自举排在 v1.0 而不是更早。** 自举要求语言在泛型、trait、错误处理、`comptime`
上都足够稳定，否则会陷入「为了通过自举测试而扭曲语言」的循环。

## 参与

路线图上的每一项都可以被认领。见[贡献指南](/community/contributing/)。

版本发布记录见[博客](/blog/)。教程每章的实现状态见[教程概览](/learn/)。