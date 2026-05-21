/**
 * Registry for `defineNode(...)` outputs (D18 Phase 1 scaffolding).
 *
 * Phase 1: this module is empty / unused. The existing
 * `extension-api-service.ts` continues to push into its module-local
 * `nodeExtensions` array on import-time side effect.
 *
 * Phase 2: the side-effect path is removed, the loader walks every
 * imported extension module and calls `register(...)` on each branded
 * `defineNode` result.
 *
 * @internal — runtime-only; not part of `@comfyorg/extension-api`.
 */

import type { NodeExtensionOptions } from '@/extension-api/types'

const _nodeExtensions: NodeExtensionOptions[] = []

export function register(options: NodeExtensionOptions): void {
  _nodeExtensions.push(options)
}

export function getAll(): readonly NodeExtensionOptions[] {
  return _nodeExtensions
}

/** @internal Test-only. */
export function _clearForTesting(): void {
  _nodeExtensions.length = 0
}
