import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { reportError } from '@comfyorg/telemetry/reportError'

import { api } from '@/scripts/api'
import { defaultGraph } from '@/scripts/defaultGraph'

const DEFAULT_WORKFLOW_ROUTE = '/default_workflow'
const PREFETCH_TIMEOUT_MS = 10_000

function usesLegacyDefaultGraph(): boolean {
  return import.meta.env.VITE_USE_LEGACY_DEFAULT_GRAPH === 'true'
}

let remoteDefaultWorkflow: ComfyWorkflowJSON | null = null
let prefetch: Promise<void> | null = null

function reportFallback(cause: unknown, errorType: string): void {
  reportError(cause, { errorType, surface: 'graph', level: 'warning' })
}

function asTemplate({
  id: _documentId,
  ...workflow
}: ComfyWorkflowJSON): ComfyWorkflowJSON {
  return workflow
}

async function readDefaultWorkflow(
  signal: AbortSignal
): Promise<ComfyWorkflowJSON | null> {
  try {
    const res = await api.fetchApi(DEFAULT_WORKFLOW_ROUTE, { signal })
    if (!res.ok) {
      if (res.status !== 404) {
        reportFallback(
          new Error(`${DEFAULT_WORKFLOW_ROUTE} responded ${res.status}`),
          'default_workflow_route_unavailable'
        )
      }
      return null
    }
    const json: unknown = await res.json()
    return await validateComfyWorkflow(json, (error) => {
      reportFallback(new Error(error), 'default_workflow_invalid')
    })
  } catch (cause) {
    if (!signal.aborted) {
      reportFallback(cause, 'default_workflow_fetch_failed')
    }
    return null
  }
}

async function fetchDefaultWorkflow(): Promise<ComfyWorkflowJSON | null> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const bound = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      reportFallback(
        new Error(
          `${DEFAULT_WORKFLOW_ROUTE} did not settle within ${PREFETCH_TIMEOUT_MS}ms`
        ),
        'default_workflow_timed_out'
      )
      controller.abort()
      resolve(null)
    }, PREFETCH_TIMEOUT_MS)
  })

  try {
    return await Promise.race([readDefaultWorkflow(controller.signal), bound])
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
