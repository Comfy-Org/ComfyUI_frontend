/**
 * D18 Phase 1 — brand symbols for `define*` outputs.
 *
 * Per D18, `defineNode` / `defineWidget` / `defineExtension` will become
 * pure functions whose return values are recognized at registration time
 * by a loader that walks module exports and dispatches based on the brand.
 *
 * Phase 1 (this file) introduces the brand symbol and the `isBrandedExtension`
 * type-guard. The `define*` functions stamp the brand on their returned
 * options so a future loader can identify them. Side-effect registration
 * remains unchanged in Phase 1; Phase 2 removes it.
 *
 * The brand is a `Symbol.for(...)` so HMR + duplicate-package scenarios still
 * resolve to the same identity (per realm / per JS context).
 *
 * @internal — not re-exported from `@comfyorg/extension-api/index.ts`. The
 * loader lives inside the runtime, not in the published package.
 */

export const EXTENSION_BRAND = Symbol.for('@comfyorg/extension-api:brand')

export type ExtensionKind = 'node' | 'widget' | 'app'

export interface Branded {
  readonly [EXTENSION_BRAND]: ExtensionKind
}

/**
 * Stamp a brand on an options object and freeze it. Returned reference is
 * the same object — branding is non-enumerable so JSON serialization,
 * spread operations, and shallow-equal comparisons are unaffected.
 */
export function stampBrand<T extends object>(
  options: T,
  kind: ExtensionKind
): T & Branded {
  Object.defineProperty(options, EXTENSION_BRAND, {
    value: kind,
    enumerable: false,
    writable: false,
    configurable: false
  })
  return Object.freeze(options) as T & Branded
}

/**
 * Type-guard for branded extension options. The loader uses this to
 * decide whether a module export is a `defineX(...)` result.
 *
 * Unbranded values (utility exports, constants, helper functions) return
 * `false` and are silently ignored by the loader.
 */
export function isBrandedExtension(value: unknown): value is Branded {
  if (value === null || typeof value !== 'object') return false
  const kind = (value as Record<symbol, unknown>)[EXTENSION_BRAND]
  return kind === 'node' || kind === 'widget' || kind === 'app'
}

export function getBrandKind(value: Branded): ExtensionKind {
  return value[EXTENSION_BRAND]
}
