/**
 * Axiom-Excluded Test Annotation Helper
 *
 * Per the Axiom-Excluded Test Annotation Policy
 * (`AXIOMS.md §Axiom-Excluded Test Annotation Policy`, AGENTS.md Rule 11,
 * `decisions/D-ban-runtime-addwidget.md §Testing policy`).
 *
 * When a source-code surface is removed/deferred per an accepted axiom or
 * ADR, BC tests that asserted on the absent surface MUST be converted to
 * this helper rather than deleted outright. The annotated test continues
 * to run; if the surface is ever re-introduced (intentionally or by
 * regression) the expected-failure flips to a real failure and surfaces
 * the policy violation.
 *
 * Mechanism: wraps vitest `test.fails(...)` and writes structured
 * metadata to `task.meta.annotations` (vitest 1.x+). Reporters and
 * tooling can pivot on the annotation to surface a per-axiom dashboard.
 *
 * @example
 * ```ts
 * import { axiomExcluded } from './helpers/axiomExcluded'
 *
 * axiomExcluded({
 *   axiom: 'A15',
 *   adr: 'decisions/D-ban-runtime-addwidget.md',
 *   rationale: 'Widgets are schema-declared per A15; v2 NodeHandle does not expose addWidget/addDOMWidget.',
 *   migration: [
 *     'Declare in INPUT_TYPES',
 *     'Boxed widget (e.g. BBOX)',
 *     'Non-widget UI primitive via bootstrap-hooks'
 *   ],
 *   restoration: 'D-ban-runtime-addwidget §Restoration criteria'
 * })('addDOMWidget dispatches CreateWidget command', () => {
 *   // Original test body — asserts the absent surface.
 *   // Now expected to fail; test.fails converts the throw to a PASS.
 * })
 * ```
 *
 * @see AXIOMS.md §Axiom-Excluded Test Annotation Policy
 * @see AGENTS.md Rule 11
 * @see decisions/D-ban-runtime-addwidget.md
 */

import { test } from 'vitest'

export interface AxiomExcludedAnnotation {
  /** Short axiom id, e.g. `'A15'` or `'A14:REMOVED'`. */
  axiom: string
  /** Workspace ADR path, e.g. `'decisions/D-ban-runtime-addwidget.md'`. */
  adr: string
  /** One-sentence summary of why the surface is absent. */
  rationale: string
  /** Migration paths the original consumer should take. */
  migration: string[]
  /** Optional cross-ref to ADR restoration criteria. */
  restoration?: string
}

/**
 * Returns a vitest test factory that registers expected-failure tests
 * with structured axiom-exclusion annotations.
 *
 * The returned factory has the same call signature as `test.fails`:
 * `(name, fn)` or `(name, fn, timeout)`.
 */
export function axiomExcluded(annotation: AxiomExcludedAnnotation) {
  return function axiomExcludedTest(
    name: string,
    fn: () => void | Promise<void>,
    timeout?: number
  ): void {
    // test.fails: passes if fn throws, fails if fn succeeds — gives us the
    // "regression alarm" semantics: if the absent surface is restored, the
    // body's assertions stop throwing and this test starts failing.
    test.fails(
      name,
      async (context) => {
        // Attach the annotation to task.meta so reporters and tooling can
        // pivot on it (vitest exposes task.meta on the runner task).
        const task = (
          context as unknown as {
            task?: { meta?: Record<string, unknown> }
          }
        ).task
        if (task) {
          task.meta = task.meta ?? {}
          ;(task.meta as Record<string, unknown>).axiomExcluded = annotation
        }
        await fn()
      },
      timeout
    )
  }
}
