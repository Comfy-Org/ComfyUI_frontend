import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

interface DeploymentAgentRequest {
  targetId: string
  text: string
}

export const useDeploymentAgentStore = defineStore('deploymentAgent', () => {
  const pending = shallowRef<DeploymentAgentRequest>()

  function request(targetId: string, text: string) {
    pending.value = { targetId, text }
  }

  function consume(request: DeploymentAgentRequest) {
    if (pending.value !== request) return false
    pending.value = undefined
    return true
  }

  return { pending, request, consume }
})
