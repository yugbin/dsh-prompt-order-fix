# @tiyirt/dsh-prompt-order-fix

DeepSeek Harness **确定性 system-prompt section 排序**修复插件。

修复一个真实 bug：DSH 会话恢复（resume / 重启）后，system prompt 的 section 排序
不稳定，导致 **KV 缓存命中率从 ~99% 暴跌到 ~1%**。

## 问题根因

官方 `@deepseek-ai/dsh-system-prompt` 的 `assemble()` 用稳定排序：

```js
sections.sort((a, b) => a.order - b.order)
```

稳定排序意味着：**两个 `order` 相同的 section，按注册（插入）顺序排队**。
而注册顺序跨 resume/重启不稳定——host 层插件与 preset 层插件的挂载顺序可能
不同。实测冲突：

| section | 来源插件 | order |
|---|---|---|
| `tool:workflow`（`Use the workflow tool ONLY...`） | `@deepseek-ai/dsh-tool-workflow` | **115** |
| `tool:cordis`（`# Dynamic Cordis Plugins`） | `@deepseek-ai/dsh-tool-cordis` | **115** |

两者都是 `order: 115`，重启后可能互换位置 → system prompt 前缀字节变化 →
provider KV 缓存 key 全部失效 → 整段历史全量重算（input 高达数十万 token，
命中率 1% 上下）。

## 修复方式

本包继承官方 `SystemPrompt` 并覆写 `assemble()`，把排序换成**确定性 tie-breaker**：

```
1. order 升序
2. 同 order  → 名字长度升序
3. 同长度   → 名字字典序
```

纯函数、静态、与注册顺序无关 → 每次组装结果一致 → 前缀稳定 → 缓存命中延续。
`tool:cordis`（11 字符）恒在 `tool:workflow`（13 字符）之前。

## 安装

### 方式 A：替换 host 组合里的 `system-prompt` 行

把 profile 的 `cordis.patch.yml`（`~/.dsh/profiles/<name>/cordis.patch.yml`）改为：

```yaml
- id: system-prompt
  name: '@tiyirt/dsh-prompt-order-fix'
```

（先 `dsh plugin --profile <name> add file:<本包路径>` 安装本包。）

### 方式 B：alias 顶替（不动组合文件）

```bash
dsh plugin --profile web add "@deepseek-ai/dsh-system-prompt@npm:@tiyirt/dsh-prompt-order-fix"
```

> 两种方式都需**完全重启 dsh** 生效（浏览器刷新不加载新 profile bundle）。

## Config

与官方 `@deepseek-ai/dsh-system-prompt` **完全一致**，drop-in 替换，无新增配置：

| 键 | 默认 | 含义 |
|---|---|---|
| `includeHarnessIdentity` | `true` | 是否含固定 harness 身份段 |
| `includeRuntimeContext` | `true` | 是否含动态运行时上下文 |
| `persona` | `''` | order-0 persona 模板 |
| `toolOrder` | — | 工具显式顺序（含 `<unlisted-tools>`） |

## 验证

安装并重启后，会话恢复（resume）前后 `tool:cordis` / `tool:workflow` 的排列
保持固定，命中率不再因排序漂移而暴跌。

## Known Limitations and Deferred Work

- 覆写 `assemble()` 是复制官方逻辑后的局部改动；DSH 若升级改变 `assemble()`
  内部实现，本包需同步跟进（当前基线 `0.1.0-rc.6`）。
- 官方若未来修复同 order 排序（增加 tie-breaker），本包可退役：移除 patch 行
  即还原官方行为。
- 本次修复针对 **sections / contexts 的同 order 排序**；工具 schema（`tools`）
  官方已有确定性排序（字典序 / `toolOrder`），无需改动。

## License

MIT
