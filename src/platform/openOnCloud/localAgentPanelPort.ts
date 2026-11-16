import { inject, ref } from 'vue'
import type { InjectionKey, Ref } from 'vue'

export interface LocalAgentPanelPort {
  enabled: Readonly<Ref<boolean>>
  isOpening: Readonly<Ref<boolean>>
  open(prompt: string, isStillWanted: () => boolean): Promise<boolean>
}

export const LocalAgentPanelPortKey: InjectionKey<LocalAgentPanelPort> = Symbol(
  'localAgentPanelPort'
)

const NO_AGENT: LocalAgentPanelPort = {
  enabled: ref(false),
  isOpening: ref(false),
  open: async () => false
}

export function useLocalAgentPanelPort(): LocalAgentPanelPort {
  return inject(LocalAgentPanelPortKey, NO_AGENT)
}
