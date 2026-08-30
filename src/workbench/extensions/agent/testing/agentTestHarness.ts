import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { vi } from 'vitest'

import type {
  AgentEventSource,
  WorkflowTurnContext
} from '../composables/agent/useAgentSession'
import type {
  AgentCancelAccepted,
  AgentMessages,
  AgentThreadSummary,
  AgentTurnAccepted,
  UploadImageResult
} from '../schemas/agentApiSchema'
import type { AgentRestClient } from '../services/agent/agentRestClient'

interface AgentTestHarnessOptions {
  enabled?: boolean
  rest?: Partial<AgentRestClient>
}

export function createAgentTestHarness(options: AgentTestHarnessOptions = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  localStorage.clear()

  let eventListener: ((raw: unknown) => void) | undefined
  const unsubscribe = vi.fn(() => {
    eventListener = undefined
  })
  const events: AgentEventSource = {
    subscribe: vi.fn((listener) => {
      eventListener = listener
      return unsubscribe
    })
  }
  const rest: AgentRestClient = {
    postMessage: vi.fn(
      async (): Promise<AgentTurnAccepted> => ({
        thread_id: 'thread-1',
        message_id: 'turn-1'
      })
    ),
    getMessages: vi.fn(async (): Promise<AgentMessages> => []),
    listThreads: vi.fn(async (): Promise<AgentThreadSummary[]> => []),
    listCloudWorkflows: vi.fn(async () => []),
    cancelMessage: vi.fn(
      async (): Promise<AgentCancelAccepted> => ({ status: 'cancelling' })
    ),
    uploadImage: vi.fn(
      async (): Promise<UploadImageResult> => ({
        name: 'asset.png',
        subfolder: '',
        type: 'input'
      })
    ),
    ...options.rest
  }
  const workflow = ref<WorkflowTurnContext>()

  return {
    auth: { getAuthHeader: () => 'Bearer test-token' },
    enabled: ref(options.enabled ?? true),
    events,
    emit: (raw: unknown) => eventListener?.(raw),
    pinia,
    rest,
    unsubscribe,
    workflow: {
      context: workflow,
      current: () => workflow.value,
      adopted: vi.fn()
    },
    teardown() {
      unsubscribe()
      localStorage.clear()
    }
  }
}
