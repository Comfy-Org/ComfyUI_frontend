import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { api } from '@/scripts/api'
import { defaultGraph } from '@/scripts/defaultGraph'

const DEFAULT_WORKFLOW_ROUTE = '/default_workflow'
const PREFETCH_TIMEOUT_MS = 10_000

const usesLegacyDefaultGraph = () =>
  import.meta.env.VITE_USE_LEGACY_DEFAULT_GRAPH === 'true'

let remoteDefaultWorkflow: ComfyWorkflowJSON | null = null
let prefetch: Promise<void> | null = null

function reportFallback(cause: unknown, errorType: string): void {
  reportError(cause, { errorType, surface: 'graph', level: 'warning' })
}

function asTemplate({ id: _documentId, ...workflow }: ComfyWorkflowJSON) {
  return workflow
}

async function readDefaultWorkflow(): Promise<ComfyWorkflowJSON | null> {
  try {
    const res = await api.fetchApi(DEFAULT_WORKFLOW_ROUTE)
    if (!res.ok) {
      if (res.status !== 404) {
        reportFallback(
          new Error(`${DEFAULT_WORKFLOW_ROUTE} responded ${res.status}`),
          'DefaultWorkflowRouteUnavailable'
        )
      }
      return null
    }
    const json: unknown = await res.json()
    const workflow = await validateComfyWorkflow(json, (error) => {
      reportFallback(new Error(error), 'DefaultWorkflowInvalid')
    })
    return workflow
  } catch (cause) {
    reportFallback(cause, 'DefaultWorkflowFetchFailed')
    return null
  }
}

async function fetchDefaultWorkflow(): Promise<ComfyWorkflowJSON | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const bound = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      reportFallback(
        new Error(
          `${DEFAULT_WORKFLOW_ROUTE} did not settle within ${PREFETCH_TIMEOUT_MS}ms`
        ),
        'DefaultWorkflowTimedOut'
      )
      resolve(null)
    }, PREFETCH_TIMEOUT_MS)
  })

  try {
    return await Promise.race([readDefaultWorkflow(), bound])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Loads the backend's default workflow, if it serves one. Requests it at most
 * once per page load and never rejects: every failure resolves to the bundled
 * default.
 */
export function initDefaultWorkflow(): Promise<void> {
  if (usesLegacyDefaultGraph()) return Promise.resolve()
  prefetch ??= fetchDefaultWorkflow().then((workflow) => {
    remoteDefaultWorkflow = workflow
  })
  return prefetch
}

/**
 * The backend's default workflow when one loaded, otherwise the bundled graph.
 * Always free of a document identity, so each caller mints its own.
 */
export function getDefaultWorkflow(): ComfyWorkflowJSON {
  return asTemplate(remoteDefaultWorkflow ?? defaultGraph)
}

/** Drops the prefetched workflow so the request runs again. */
export function resetDefaultWorkflowForTesting(): void {
  remoteDefaultWorkflow = null
  prefetch = null
}
