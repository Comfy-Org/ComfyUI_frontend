/**
 * runV2 — placeholder runner for v2 extension snippets.
 *
 * Status: STUB. Mirrors runV1 — provides a stable callable surface
 * for generated `it.todo` stubs so they compile without depending on
 * the Phase B ECS World.
 *
 * NOTE: The real `@/services/extensionV2Service` currently imports
 * `@/ecs/world`, `@/ecs/commands`, `@/ecs/components`,
 * `@/ecs/entityIds` — modules that don't exist yet (they land in
 * Phase B / sibling PR #3 onwards). Importing the real service from
 * here would break `pnpm typecheck` for the whole repo. So for the
 * harness we stand up an isolated registry that records v2
 * extension registrations and can be inspected by tests.
 *
 * Once the ECS World lands, this file becomes a thin adapter over
 * `defineNodeExtension` / `defineWidgetExtension` from the real
 * service.
 */

import type {
  NodeExtensionOptions,
  WidgetExtensionOptions
} from '@/types/extensionV2'

import { createMiniComfyApp } from './comfyApp'
import type { MiniComfyApp } from './comfyApp'

interface RunV2Result {
  app: MiniComfyApp
  nodeExtensions: NodeExtensionOptions[]
  widgetExtensions: WidgetExtensionOptions[]
  errors: Error[]
}

interface RunV2Options {
  app?: MiniComfyApp
}

/**
 * Pretend to execute a v2 snippet. Captures any `defineNodeExtension`
 * / `defineWidgetExtension` calls into a per-run registry so tests
 * can assert without touching the global state of the real service.
 */
export function runV2(snippet: string, options: RunV2Options = {}): RunV2Result {
  const app = options.app ?? createMiniComfyApp()
  const errors: Error[] = []
  const nodeExtensions: NodeExtensionOptions[] = []
  const widgetExtensions: WidgetExtensionOptions[] = []

  if (typeof snippet !== 'string') {
    errors.push(new Error('runV2: snippet must be a string'))
  }

  // TODO(I-WS / Phase B): actually evaluate `snippet` in a sandbox
  // that exposes `defineNodeExtension`, `defineWidgetExtension`, and
  // friends from `@/services/extensionV2Service`. For now we just
  // return empty registries.

  return {
    app,
    nodeExtensions,
    widgetExtensions,
    errors
  }
}
