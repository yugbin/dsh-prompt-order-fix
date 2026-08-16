/**
 * `@tiyirt/dsh-prompt-order-fix` — 确定性 system-prompt section 排序。
 *
 * 修复 DSH 会话恢复（resume/重启）时 system prompt 前缀漂移导致的 KV 缓存
 * 断层：官方 `dsh-system-prompt` 的 `assemble()` 用稳定排序，同 `order` 的
 * section 靠注册顺序排队，而注册顺序跨重启不稳定（实测 `dsh-tool-workflow`
 * 与 `dsh-tool-cordis` 均为 `order: 115`），导致重启后两者互换位置 → 前缀
 * 变化 → 缓存全 miss。
 *
 * 本包是官方服务的**类插件替换**（形态与官方一致：default export 继承
 * `SystemPrompt` 的类），把两处排序换成确定性 tie-breaker（order → 名字长度
 * → 字典序），与注册顺序无关，因此每次组装结果一致、缓存命中延续。
 *
 * 安装：把 host 组合里 `system-prompt` 行的 `name` 替换为本包，或
 * `dsh plugin --profile web add file:.../dsh-prompt-order-fix` 后 patch。
 *
 * 注意：本包是 Service 类插件替换，不是普通函数插件——Loader 需要 default
 * export 类（与官方 `@deepseek-ai/dsh-system-prompt` 一致），故不使用
 * 函数插件的 named-export apply 形态。
 */

import { DeterministicSystemPrompt } from './provider.ts'

export { DeterministicSystemPrompt } from './provider.ts'
export default DeterministicSystemPrompt

// 与官方包保持同构的命名导出，方便 alias 安装 / drop-in 替换。
export {
  PERSONA_ORDER,
  PERSONA_SECTION,
  TOOL_ORDER_REST,
  joinContextSections,
  renderContextSections,
  renderContextSnapshot,
  renderPrompt,
} from '@deepseek-ai/dsh-system-prompt'
export type {
  AssembleContext,
  AssembledContext,
  AssembledSection,
  Config,
  PromptAssembly,
  PromptContext,
  PromptSection,
  ToolProviderResult,
} from '@deepseek-ai/dsh-system-prompt'
