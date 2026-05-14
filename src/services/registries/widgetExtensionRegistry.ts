/**
 * Registry for `defineWidget(...)` outputs (D18 Phase 1 scaffolding).
 *
 * See `nodeExtensionRegistry.ts` for the rollout plan and
 * `decisions/D18-pure-functions-loader-registration.md` for rationale.
 *
 * @internal — runtime-only; not part of `@comfyorg/extension-api`.
 */

import type { WidgetExtensionOptions } from '@/extension-api/types'

const _widgetExtensions: WidgetExtensionOptions[] = []

export function register(options: WidgetExtensionOptions): void {
  _widgetExtensions.push(options)
}

export function getAll(): readonly WidgetExtensionOptions[] {
  return _widgetExtensions
}

/** @internal Test-only. */
export function _clearForTesting(): void {
  _widgetExtensions.length = 0
}
