/**
 * Stands in for `@/i18n`, which the harness cannot load.
 *
 * `LGraphNode` reaches i18n through `BaseWidget`, and `src/i18n.ts` uses
 * `import.meta.glob` to collect locale files — a Vite primitive that throws
 * under plain Node. Translation has no bearing on whether a converted pack
 * registers its types or serialises identically, so the key is returned as-is.
 */
const identity = (key) => String(key)

export const t = identity
export const te = () => false
export const d = identity
export const st = (_key, fallback) => fallback
export const stRaw = (_key, fallback) => fallback
export const i18n = { global: { t: identity, te: () => false, d: identity } }
export const resolveSupportedLocale = () => 'en'
export async function loadLocale() {}
export async function setActiveLocale() {}
export function mergeCustomNodesI18n() {}
