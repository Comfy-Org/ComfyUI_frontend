import { inject, ref } from 'vue'
import type { InjectionKey, Ref } from 'vue'

import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'

export interface AskAgentPort {
  canAskAgent: Readonly<Ref<boolean>>
  askAgentAboutIssues(context: AgentErrorContext): Promise<void>
}

export const AskAgentPortKey: InjectionKey<AskAgentPort> =
  Symbol('askAgentPort')

const NO_AGENT: AskAgentPort = {
  canAskAgent: ref(false),
  askAgentAboutIssues: () => Promise.resolve()
}

export function useAskAgentPort(): AskAgentPort {
  return inject(AskAgentPortKey, NO_AGENT)
}
