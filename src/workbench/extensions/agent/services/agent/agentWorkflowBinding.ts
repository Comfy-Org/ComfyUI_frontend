import { z } from 'zod'

/**
 * agentWorkflowBinding: mints a server-side session workflow so agent drafts have a
 * workflow_id to bind to.
 *
 * The FE has no uuid surface for the open workflow today (workflow classes are path-keyed
 * and /api/workflows is unused in src), but the agent backend keys drafts by that server
 * uuid: the POST message takes an optional workflow_id, and GET /api/agent/draft is keyed
 * by it. This binding mirrors the backend's own test flow - POST a workflow, adopt the
 * returned id - so draft_patch/draft_version events resolve to a bound draft that drives the
 * canvas. TODO(FE-1187): replace with the host's real cloud workflow id once the FE adopts
 * the /api/workflows model.
 */

// Tolerant: the 201 may carry more than id (created_at, name, ...); only id is required.
const zWorkflowCreated = z.object({ id: z.string() }).passthrough()

export interface AgentWorkflowBindingDeps {
  getAuthToken: () => string | undefined | Promise<string | undefined>
  fetchImpl?: typeof fetch
  serializeGraph: () => unknown
}

export interface AgentWorkflowBinding {
  // Mint the workflow if needed and resolve its id, or undefined if minting failed.
  ensure: () => Promise<string | undefined>
  // The currently bound id, or undefined before a successful ensure().
  current: () => string | undefined
}

export function createAgentWorkflowBinding(
  deps: AgentWorkflowBindingDeps
): AgentWorkflowBinding {
  const { getAuthToken, fetchImpl = globalThis.fetch, serializeGraph } = deps

  let workflowId: string | undefined
  // Single-flight: overlapping ensure() calls (e.g. the connect baseline and the first
  // send) collapse to one POST and share its result.
  let inFlight: Promise<string | undefined> | null = null

  async function mint(): Promise<string | undefined> {
    try {
      const token = await getAuthToken()
      const response = await fetchImpl('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: 'AI Agent session',
          workflow_json: serializeGraph()
        })
      })
      if (!response.ok)
        throw new Error(`workflow create failed: ${response.status}`)
      workflowId = zWorkflowCreated.parse(await response.json()).id
      return workflowId
    } catch (error) {
      // Chat degrades gracefully to an unbound session rather than throwing; warn once so
      // the failure is visible without breaking the send path.
      console.warn('[agent] could not mint a session workflow', error)
      return undefined
    }
  }

  async function ensure(): Promise<string | undefined> {
    if (workflowId !== undefined) return workflowId
    if (inFlight) return inFlight
    inFlight = mint().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  return {
    ensure,
    current: () => workflowId
  }
}
