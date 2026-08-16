/**
 * 包级 invariant 伴侣：`@tiyirt/dsh-prompt-order-fix/invariant`。
 * 每个包必须拥有 `./invariant`；检查一个事件/数据关系，或给出包特定理由。
 */
const PACKAGE_NAME = '@tiyirt/dsh-prompt-order-fix';
/** Cordis companion plugin name. */
export const name = 'dsh-prompt-order-fix-invariant';
/** 服务必需才能保留包所有权。 */
export const inject = ['invariants'];
/**
 * 运行时不变式：确定性排序必须恒成立——
 * 对任意两个同 order 的 section/context，`compareByOrderThenName` 的结果
 * 只取决于静态字段（order、name.length、name 字典序），与注册顺序无关。
 * 本包在 `provider.ts` 里通过纯函数实现该规则；此处不做可变数据检查。
 */
const install = () => { };
/**
 * 注册本包的 invariant 伴侣。
 * @returns 安装成功后注册的 disposer。
 */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//# sourceMappingURL=invariant.js.map