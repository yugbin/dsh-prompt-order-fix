/**
 * 包级 invariant 伴侣：`@tiyirt/dsh-prompt-order-fix/invariant`。
 * 每个包必须拥有 `./invariant`；检查一个事件/数据关系，或给出包特定理由。
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis companion plugin name. */
export declare const name = "dsh-prompt-order-fix-invariant";
/** 服务必需才能保留包所有权。 */
export declare const inject: string[];
/**
 * 注册本包的 invariant 伴侣。
 * @returns 安装成功后注册的 disposer。
 */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map