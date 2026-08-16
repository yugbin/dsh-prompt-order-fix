/**
 * @tiyirt/dsh-prompt-order-fix — deterministic ordering provider.
 *
 * 修复 DSH system-prompt 在会话恢复（resume/重启）时 section 排序漂移导致的
 * KV 缓存断层：官方 `assemble()` 用稳定排序 `sort((a,b) => a.order - b.order)`，
 * 同 order 的 section 靠注册（插入）顺序排队，而注册顺序跨重启不稳定，导致
 * 两个同 order 的 section（实测 `dsh-tool-workflow` 与 `dsh-tool-cordis` 均为
 * 115）在重启后互换位置 → system prompt 前缀变化 → provider 缓存 key 全失效。
 *
 * 本 provider 覆写 `assemble()`，把排序换成确定性 tie-breaker：
 *   order 升序 → 同 order 按名字长度 → 同长度按字典序。
 * 纯函数、静态、与注册顺序无关，因此每次组装结果一致。
 */
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import type { AssembleContext, PromptAssembly } from '@deepseek-ai/dsh-system-prompt';
/**
 * SystemPrompt subclass with deterministic section/context ordering.
 *
 * The official `assemble()` is reproduced verbatim except for the two stable
 * sorts, replaced by `compareByOrderThenName`. Variable resolution, scoped
 * shadowing, the `system-prompt/assemble` waterfall, complete-section
 * restoration, and tool ordering behave exactly as upstream.
 *
 * The official `layers` / `toolOrder` are TS-private (plain runtime fields),
 * so they are read through a typed internal projection.
 */
export declare class DeterministicSystemPrompt extends SystemPrompt {
    /** @inheritdoc */
    assemble(context?: AssembleContext): Promise<PromptAssembly>;
}
export default DeterministicSystemPrompt;
//# sourceMappingURL=provider.d.ts.map