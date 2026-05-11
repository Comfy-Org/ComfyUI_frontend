/**
 * runV1 — placeholder runner for v1 (legacy) extension snippets.
 *
 * Status: STUB. The real impl will eval/transpile the snippet against
 * a real `app.registerExtension` shim wired to a fixture LGraph. For
 * I-TF.3 we only need a callable surface so generated tests can
 * import it and live as `it.todo`.
 *
 * Why not eval today:
 *   - v1 snippets often pull `app` from `'/scripts/app.js'`, mutate
 *     `LGraphNode.prototype`, etc. Standing that up is sibling I-WS /
 *     Phase B work.
 *   - The harness World here is intentionally side-effect free.
 */

import { createMiniComfyApp } from './comfyApp'
import type { MiniComfyApp } from './comfyApp'

interface RunV1Result {
  app: MiniComfyApp
  registered: number
  errors: Error[]
}

interface RunV1Options {
  app?: MiniComfyApp
}

/**
 * Pretend to execute a v1 snippet. Today this just returns a usable
 * `MiniComfyApp` instance and records that the snippet was "seen" so
 * tests can assert against the surface.
 */
export function runV1(snippet: string, options: RunV1Options = {}): RunV1Result {
  const app = options.app ?? createMiniComfyApp()
  const errors: Error[] = []

  if (typeof snippet !== 'string') {
    errors.push(new Error('runV1: snippet must be a string'))
  }

  // TODO(I-WS / Phase B): actually evaluate `snippet` in a sandbox
  // that exposes `app`, `LiteGraph`, `LGraphNode`, etc.
  // For now we just return the harness so that `it.todo` stubs can
  // chain to it without throwing.

  return {
    app,
    registered: app.extensions.length,
    errors
  }
}
