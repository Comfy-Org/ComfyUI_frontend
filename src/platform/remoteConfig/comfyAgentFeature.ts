import { ServerFeatureFlag } from '@/platform/remoteConfig/serverFeatureFlag'
import { api } from '@/scripts/api'

/**
 * The one declaration of ComfyUI's `agent` server feature, pushed again on
 * every change. Both the agent panel and the skill picker read it through this
 * module; a second copy anywhere else is what lets the two surfaces drift.
 *
 * Not sourced from a generated contract, and neither generated package can
 * supply it today:
 * - ingest's `GetFeaturesResponse['agent']` is `{ state: 'ready' }` — Cloud's
 *   rollout gate for a different server. Widening it by hand would make one
 *   type claim two unrelated payloads.
 * - `@comfyorg/comfyui-api-types` is generated from `openapi.yaml`, vendored
 *   byte-identical from `Comfy-Org/ComfyUI` behind a sha256 pin that
 *   `check:generated` enforces, and that spec declares no `agent` feature. A
 *   generated source therefore needs the schema added in core first.
 */
export interface ComfyAgentFeature {
  state: 'starting' | 'ready' | 'failed'
  reason?: string | null
}

function isKnownState(state: unknown): state is ComfyAgentFeature['state'] {
  return state === 'starting' || state === 'ready' || state === 'failed'
}

/**
 * ComfyUI's `agent` server feature, or undefined while its state is unknown.
 * The standalone harness runs its own agent, so it ignores ComfyUI's.
 */
export function readComfyAgentFeature(): ComfyAgentFeature | undefined {
  if (import.meta.env.VITE_AGENT_STANDALONE === 'true') return undefined
  const agent = api.getServerFeature<
    { state?: unknown; reason?: unknown } | null | undefined
  >(ServerFeatureFlag.AGENT)
  if (!agent || !isKnownState(agent.state)) return undefined
  const { state, reason } = agent
  if (reason === undefined || reason === null || typeof reason === 'string')
    return agent as ComfyAgentFeature
  return { state }
}

/** Whether ComfyUI hosts an agent that is ready to serve requests. */
export function isComfyAgentReady(): boolean {
  return readComfyAgentFeature()?.state === 'ready'
}
