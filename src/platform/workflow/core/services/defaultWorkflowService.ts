import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { defaultGraph } from '@/scripts/defaultGraph'

/**
 * Resolves the workflow new users land on.
 *
 * Core owns the default workflow as of ComfyUI#16956, which serves it from
 * `GET /default_workflow`. Fetching it here lets core (and cloud) swap the
 * default in a one-line `server.py` change instead of waiting on a frontend
 * release, and lets each distribution ship a different one - e.g. a model
 * desktop pre-bundles, or something that does not assume a local GPU on cloud.
 *
 * The bundled `defaultGraph` stays as the fallback, so backends predating that
 * route (404), offline loads, and malformed responses all keep working.
 *
 * Resolution is a one-shot prefetch rather than a fetch per use: the three
 * places that need a default are synchronous, and core sends
 * `Cache-Control: no-cache`, so a reload is what picks up a changed default.
 */

/**
 * E2E builds pin the default to the bundled legacy graph because hundreds of
 * specs assert on its node IDs and positions. Those builds run against a real
 * core, so without this the route would serve the current default and undo
 * that pinning. See browser_tests/README.md.
 */
const usesLegacyDefaultGraph = () =>
  import.meta.env.VITE_USE_LEGACY_DEFAULT_GRAPH === 'true'

let remoteDefaultWorkflow: ComfyWorkflowJSON | null = null
let prefetch: Promise<void> | null = null

async function fetchDefaultWorkflow(): Promise<ComfyWorkflowJSON | null> {
  try {
    const res = await api.fetchApi('/default_workflow')
    if (!res.ok) {
      // 404 is the expected answer from a backend older than ComfyUI#16956.
      if (res.status !== 404) {
        console.warn(
          `[defaultWorkflow] /default_workflow returned ${res.status}; using the bundled default`
        )
      }
      return null
    }
    const json: unknown = await res.json()
    return await validateComfyWorkflow(json, (error) => {
      console.warn(
        `[defaultWorkflow] /default_workflow failed validation; using the bundled default:\n${error}`
      )
    })
  } catch (error) {
    console.warn(
      '[defaultWorkflow] could not load /default_workflow; using the bundled default',
      error
    )
    return null
  }
}

/**
 * Loads the backend's default workflow, if it serves one. Safe to call more
 * than once - the request is made at most once per page load. Never rejects:
 * every failure resolves to the bundled default.
 */
export function initDefaultWorkflow(): Promise<void> {
  if (usesLegacyDefaultGraph()) return Promise.resolve()
  prefetch ??= fetchDefaultWorkflow().then((workflow) => {
    remoteDefaultWorkflow = workflow
  })
  return prefetch
}

/**
 * The default workflow: the backend's if {@link initDefaultWorkflow} resolved
 * one, otherwise the bundled graph. Callers clone before mutating, as they
 * already did when this was a plain import.
 */
export function getDefaultWorkflow(): ComfyWorkflowJSON {
  return remoteDefaultWorkflow ?? defaultGraph
}

/** Test seam: drops the prefetched workflow and lets the request run again. */
export function resetDefaultWorkflowForTesting(): void {
  remoteDefaultWorkflow = null
  prefetch = null
}
