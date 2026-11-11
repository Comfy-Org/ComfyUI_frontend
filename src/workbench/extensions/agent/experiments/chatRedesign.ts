import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

export const CHAT_REDESIGN_FLAG = 'agent-chat-redesign'

export type AgentExperience = 'classic' | 'redesign'

export function resolveAgentExperience(): AgentExperience {
  const enabled =
    getSessionOverride<boolean>(CHAT_REDESIGN_FLAG) ??
    getDevOverride<boolean>(CHAT_REDESIGN_FLAG) ??
    remoteConfig.value[CHAT_REDESIGN_FLAG]
  return enabled === true ? 'redesign' : 'classic'
}
