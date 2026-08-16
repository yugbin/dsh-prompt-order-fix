/**
 * @tiyirt/dsh-prompt-order-fix — wire types.
 *
 * 本包是官方 `@deepseek-ai/dsh-system-prompt` 的 Service 类插件替换：default
 * export 一个继承官方 `SystemPrompt` 的类，仅把 `assemble()` 里两处稳定排序
 * 换成确定性 tie-breaker。Config 与官方完全一致，drop-in 替换。
 */
import type { AssembleContext, Config, PromptAssembly, PromptContext, PromptSection } from '@deepseek-ai/dsh-system-prompt';
import type { ToolSchema } from '@deepseek-ai/dsh-llm';
export type { AssembleContext, Config, PromptAssembly, PromptContext, PromptSection, ToolSchema };
/**
 * 确定性 section 排序所需的内部字段（官方 `layers`/`toolOrder` 为 TS private，
 * 运行时是普通字段，这里用类型投影跨过编译期私有边界）。
 *
 * `merge` / `chainLayers` 的条目类型刻意保持 `unknown`：跨私有边界不做精确
 * 建模，在 `provider.ts` 里对返回值做显式 cast（本包是官方服务的替换实现，
 * 该 cast 边界只有这一处）。
 */
export interface SystemPromptInternals {
    layers: {
        readonly global: {
            readonly runtimeContextSuppressors: {
                isEmpty(): boolean;
            };
            readonly variables: {
                entries(): Iterable<[string, (c: AssembleContext) => string | undefined]>;
            };
            readonly toolProviders: {
                values(): Iterable<(c: AssembleContext) => {
                    schemas: readonly ToolSchema[];
                    knownNames?: readonly string[];
                }>;
            };
        };
        chainLayers(scope?: unknown): Array<{
            readonly runtimeContextSuppressors: {
                isEmpty(): boolean;
            };
            readonly variables: {
                entries(): Iterable<[string, (c: AssembleContext) => string | undefined]>;
            };
            readonly toolProviders: {
                values(): Iterable<(c: AssembleContext) => {
                    schemas: readonly ToolSchema[];
                    knownNames?: readonly string[];
                }>;
            };
        }>;
        merge(scope: unknown, pick: (layer: unknown) => unknown): {
            values(): Iterable<unknown>;
        };
    };
    toolOrder: string[] | undefined;
}
//# sourceMappingURL=types.d.ts.map