import { ServerFeatureFlag } from '@/platform/remoteConfig/serverFeatureFlag'
import { api } from '@/scripts/api'

export interface ComfyAgentFeature {
  state: 'starting' | 'ready' | 'failed'
  reason?: string | null
}

/**
 * ComfyUI's `agent` server feature, or undefined while its state is unknown.
 * The standalone harness runs its own agent, so it ignores ComfyUI's.
 */
export function readComfyAgentFeature(): ComfyAgentFeature | undefined {
  if (import.meta.env.VITE_AGENT_STANDALONE === 'true') return undefined
  const agent = api.getServerFeature<{ state?: unknown } | null | undefined>(
    ServerFeatureFlag.AGENT
  )
  return agent?.state === 'starting' ||
    agent?.state === 'ready' ||
    agent?.state === 'failed'
    ? (agent as ComfyAgentFeature)
    : undefined
}

/** Whether ComfyUI hosts an agent that is ready to serve requests. */
export function isComfyAgentReady(): boolean {
  return readComfyAgentFeature()?.state === 'ready'
}
