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

import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt'
import { scopeTarget } from '@deepseek-ai/dsh-scope'
import type { AssembleContext, PromptAssembly, PromptContext, PromptSection } from '@deepseek-ai/dsh-system-prompt'
import type { ToolSchema } from '@deepseek-ai/dsh-llm'
import type { SystemPromptInternals } from './types.ts'

/** Lexicographic (code-unit) name comparison — locale-independent, stable everywhere. */
function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Deterministic comparator for sections/contexts:
 * 1. ascending `order`;
 * 2. equal order -> ascending name length;
 * 3. equal length  -> lexicographic name.
 * Pure and static, so the result never depends on registration order.
 */
function compareByOrderThenName(a: PromptSection | PromptContext, b: PromptSection | PromptContext): number {
  const byOrder = a.order - b.order
  if (byOrder !== 0) return byOrder
  const byLength = a.name.length - b.name.length
  if (byLength !== 0) return byLength
  return compareNames(a.name, b.name)
}

/** Reserved `toolOrder` marker for unlisted tools (official `TOOL_ORDER_REST`). */
const TOOL_ORDER_REST = '<unlisted-tools>'

/**
 * Re-implementation of the official (non-exported) `orderTools`: apply the
 * configured `toolOrder`, inserting unlisted tools lexicographically at the
 * `<unlisted-tools>` marker. Falls back to lexicographic order when no
 * `toolOrder` is configured.
 */
function orderTools(tools: ToolSchema[], toolOrder: string[] | undefined, knownNames: ReadonlySet<string>): ToolSchema[] {
  const reserved = tools.find((tool) => tool.name === TOOL_ORDER_REST)
  if (reserved !== undefined) {
    throw new Error(`tool provider returned reserved tool name "${TOOL_ORDER_REST}" (reserved for toolOrder's rest entry)`)
  }
  if (toolOrder === undefined) return tools.sort((a, b) => compareNames(a.name, b.name))
  const unknown = toolOrder.filter((name) => name !== TOOL_ORDER_REST && !knownNames.has(name))
  if (unknown.length > 0) {
    throw new Error(`toolOrder lists unregistered tool${unknown.length > 1 ? 's' : ''} ${unknown.map((name) => `"${name}"`).join(', ')}; known tools: ${[...knownNames].sort().join(', ') || '(none)'}`)
  }
  const listed = new Set(toolOrder)
  const rest = tools.filter((tool) => !listed.has(tool.name)).sort((a, b) => compareNames(a.name, b.name))
  return toolOrder.flatMap((name) =>
    name === TOOL_ORDER_REST ? rest : tools.filter((tool) => tool.name === name))
}

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
export class DeterministicSystemPrompt extends SystemPrompt {
  /** @inheritdoc */
  override async assemble(context: AssembleContext = {}): Promise<PromptAssembly> {
    const internals = this as unknown as SystemPromptInternals
    const scope = context.scope
    const scopeLayers = internals.layers.chainLayers(scope)
    const runtimeContextSuppressed = !internals.layers.global.runtimeContextSuppressors.isEmpty()
      || scopeLayers.some((layer) => !layer.runtimeContextSuppressors.isEmpty())
    const variables: Record<string, string | undefined> = {}
    for (const [name, provider] of internals.layers.global.variables.entries()) variables[name] = provider(context)
    for (const layer of scopeLayers) {
      for (const [name, provider] of layer.variables.entries()) variables[name] = provider(context)
    }
    // merge() returns unknown across the private boundary; cast to the official
    // entry shapes here (the only crossing point).
    const sectionByName = internals.layers.merge(scope, (layer) => (layer as { sections?: unknown }).sections) as { values(): Iterable<PromptSection> }
    const contextByName = internals.layers.merge(scope, (layer) => (layer as { contexts?: unknown }).contexts) as { values(): Iterable<PromptContext> }
    const providers = [
      ...internals.layers.global.toolProviders.values(),
      ...scopeLayers.flatMap((layer) => [...layer.toolProviders.values()]),
    ]
    const collected: ToolSchema[] = []
    const knownNames = new Set<string>()
    for (const provider of providers) {
      const result = provider(context)
      const schemas = result.schemas.map(({ name, description, parameters }) => ({
        name,
        description,
        parameters: structuredClone(parameters),
      }))
      const acceptedKnownNames = result.knownNames ?? schemas.map((tool) => tool.name)
      collected.push(...schemas)
      for (const name of acceptedKnownNames) knownNames.add(name)
    }
    // ★ The fix: deterministic ordering (order -> name length -> lexicographic).
    const sectionDefinitions = [...sectionByName.values()].sort(compareByOrderThenName)
    const completeSections = sectionDefinitions.filter((section) => section.complete === true)
    if (completeSections.length > 1) {
      throw new Error(`multiple complete prompt sections are active: ${completeSections.map((section) => JSON.stringify(section.name)).join(', ')}`)
    }
    let completeSection: { name: string; text: string } | undefined
    const assembly: PromptAssembly = {
      sections: sectionDefinitions.map((section) => {
        const assembled = {
          name: section.name,
          text: typeof section.text === 'function' ? section.text(context) : section.text,
        }
        if (section.complete === true) completeSection = { ...assembled }
        return assembled
      }),
      contexts: runtimeContextSuppressed
        ? []
        : [...contextByName.values()]
          .sort(compareByOrderThenName)
          .map((entry) => ({
            name: entry.name,
            text: typeof entry.text === 'function' ? entry.text(context) : entry.text,
          })),
      tools: orderTools(collected, internals.toolOrder, knownNames),
      variables,
    }
    const transformed = await this.ctx.waterfall(
      scopeTarget(this, scope), 'system-prompt/assemble', assembly, context,
      () => Promise.resolve(assembly),
    )
    if (completeSection === undefined && !runtimeContextSuppressed) return transformed
    return {
      ...transformed,
      sections: completeSection === undefined ? transformed.sections : [completeSection],
      contexts: runtimeContextSuppressed ? [] : transformed.contexts,
    }
  }
}

export default DeterministicSystemPrompt
