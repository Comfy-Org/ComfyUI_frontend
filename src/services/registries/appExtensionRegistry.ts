/**
 * Registry for `defineExtension(...)` outputs (D18 Phase 1 scaffolding).
 *
 * See `nodeExtensionRegistry.ts` for the rollout plan and
 * `decisions/D18-pure-functions-loader-registration.md` for rationale.
 *
 * @internal — runtime-only; not part of `@comfyorg/extension-api`.
 */

import type { ExtensionOptions } from '@/extension-api/types'

const _appExtensions: ExtensionOptions[] = []

export function register(options: ExtensionOptions): void {
  _appExtensions.push(options)
}

export function getAll(): readonly ExtensionOptions[] {
  return _appExtensions
}

/** @internal Test-only. */
export function _clearForTesting(): void {
  _appExtensions.length = 0
}
