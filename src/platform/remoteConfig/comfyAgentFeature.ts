import type { ComfyAgentFeature } from '@comfyorg/comfyui-api-types'

import { ServerFeatureFlag } from '@/platform/remoteConfig/serverFeatureFlag'
import { api } from '@/scripts/api'

export type { ComfyAgentFeature }

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
  if (reason === undefined || typeof reason === 'string')
    return agent as ComfyAgentFeature
  return { state }
}

/** Whether ComfyUI hosts an agent that is ready to serve requests. */
export function isComfyAgentReady(): boolean {
  return readComfyAgentFeature()?.state === 'ready'
}
