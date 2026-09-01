import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export type AgentRunMode = 'ask' | 'auto' | 'auto-limit'

// FE slice of the run-permissions control (DES-525). The persisted choice is
// not enforced yet - run gating ships with BE-3135.
export const useAgentRunModeStore = defineStore('agentRunMode', () => {
  const mode = useLocalStorage<AgentRunMode>('Comfy.Agent.RunMode', 'ask')
  const creditLimit = useLocalStorage('Comfy.Agent.RunCreditLimit', 300)

  function save(nextMode: AgentRunMode, nextLimit: number): void {
    mode.value = nextMode
    const floored = Math.floor(nextLimit)
    if (Number.isFinite(floored) && floored > 0) creditLimit.value = floored
  }

  return { mode, creditLimit, save }
})
