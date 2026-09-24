import {
  zInputUploadResponse,
  zPromptResponse,
  zJobDetailResponse,
  zJobCancelResponse,
  zJobAssetsResponse
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import type { WorkflowFailure } from '../lib/hub/run-failure'
import { workflowFailure } from '../lib/hub/run-failure'

export const workflowGraphSchema = z.record(
  z.string(),
  z.object({
    class_type: z.string(),
    inputs: z.record(z.string(), z.unknown()),
    _meta: z.object({ title: z.string() }).optional()
  })
)
export type WorkflowGraph = z.infer<typeof workflowGraphSchema>
export type WorkflowJob = ReturnType<typeof zJobDetailResponse.parse>

export function bindWorkflowInputs(
  source: WorkflowGraph,
  bindings: readonly { node: string; input: string; value: unknown }[]
): WorkflowGraph {
  const graph = Object.fromEntries(
    Object.entries(source).map(([id, node]) => [
      id,
      { ...node, inputs: { ...node.inputs } }
    ])
  )
  for (const { node, input, value } of bindings) {
    if (
      !Object.hasOwn(graph, node) ||
      !Object.hasOwn(graph[node].inputs, input)
    )
      throw new Error(`Workflow input ${node}.${input} is unavailable.`)
    graph[node].inputs[input] = value
  }
  return graph
}

export class WorkflowHttpError extends Error {
  readonly reason: WorkflowFailure
  constructor(
    readonly status: number,
    type: string | undefined
  ) {
    super(`Cloud returned ${status}.`)
    this.reason = workflowFailure(status, type)
  }
  get retrySafe() {
    return this.status >= 400 && this.status < 500
  }
}

// Cloud says which of the two things a 429 is in the body's `error.type`, and
// its documentation asks for that field rather than a match on the message.
const problemBody = z.object({
  error: z.object({ type: z.string() }).partial().optional()
})

export function createWorkflowClient(
  origin: string,
  credential: () => Promise<string>,
  fetcher: typeof fetch = (...args) => fetch(...args)
) {
  async function request(
    path: string,
    signal: AbortSignal,
    init: RequestInit = {}
  ) {
    const url = new URL(path, origin)
    if (url.origin !== new URL(origin).origin)
      throw new Error('Unexpected workflow API origin.')
    const token = await credential()
    signal.throwIfAborted()
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    const response = await fetcher(url.href, {
      ...init,
      signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      headers
    })
    if (!response.ok) {
      const body = problemBody.safeParse(
        await response.json().catch(() => undefined)
      )
      throw new WorkflowHttpError(response.status, body.data?.error?.type)
    }
    return response
  }
  return {
    async upload(file: File, signal: AbortSignal) {
      const body = new FormData()
      body.set('image', file)
      body.set('type', 'input')
      body.set('overwrite', 'false')
      const response = await request('/api/upload/image', signal, {
        method: 'POST',
        body
      })
      const asset = zInputUploadResponse.parse(await response.json())
      return asset.subfolder ? `${asset.subfolder}/${asset.name}` : asset.name
    },
    async submit(workflow: WorkflowGraph, signal: AbortSignal) {
      const token = await credential()
      const response = await request('/api/prompt', signal, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: workflow,
          extra_data: {
            auth_token_comfy_org: token,
            comfy_usage_source: 'workshop-prototype'
          }
        })
      })
      const result = zPromptResponse.parse(await response.json())
      if (!result.prompt_id)
        throw new Error(
          'Cloud did not return a job ID. Check your Cloud job history before submitting again.'
        )
      return result.prompt_id
    },
    async read(path: string, signal: AbortSignal) {
      return zJobDetailResponse.parse(
        await (await request(path, signal)).json()
      )
    },
    async outputs(id: string, signal: AbortSignal) {
      return zJobAssetsResponse.parse(
        await (
          await request(
            `/api/jobs/${encodeURIComponent(id)}/assets?limit=500`,
            signal
          )
        ).json()
      )
    },
    async outputFile(id: string, signal: AbortSignal) {
      // Fetch owns the authenticated first hop. The browser strips Authorization
      // on cross-origin redirects to the storage service.
      const token = await credential()
      signal.throwIfAborted()
      const response = await fetcher(
        new URL(
          `/api/assets/${encodeURIComponent(id)}/content?disposition=inline`,
          origin
        ),
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'omit',
          signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)])
        }
      )
      if (!response.ok)
        throw new Error(
          'Could not load this output. Open the job in Cloud to retrieve it.'
        )
      return response.blob()
    },
    async cancel(path: string, signal: AbortSignal) {
      return zJobCancelResponse.parse(
        await (await request(path, signal, { method: 'POST' })).json()
      )
    }
  }
}

export function workflowFinished(job: WorkflowJob): boolean {
  return ['completed', 'failed', 'cancelled'].includes(job.status)
}
