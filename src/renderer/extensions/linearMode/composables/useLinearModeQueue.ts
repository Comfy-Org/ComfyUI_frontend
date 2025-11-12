import { ref } from 'vue'
import { app } from '@/scripts/app'
import { useLinearModeStore } from '../stores/linearModeStore'
import type { NodeExecutionId } from '@/types/nodeIdentification'

// @knipIgnore - Will be used by Linear Mode UI components
export function useLinearModeQueue() {
  const linearModeStore = useLinearModeStore()
  const isQueueing = ref(false)
  const lastError = ref<Error | null>(null)

  async function queuePrompt(
    number: number = -1,
    batchCount: number = 1,
    queueNodeIds?: NodeExecutionId[]
  ): Promise<boolean> {
    isQueueing.value = true
    lastError.value = null

    try {
      const success = await app.queuePrompt(
        number,
        batchCount,
        queueNodeIds,
        (response) => {
          if (response.prompt_id) {
            linearModeStore.trackGeneratedPrompt(response.prompt_id)
          }
        }
      )

      return success
    } catch (error) {
      lastError.value =
        error instanceof Error ? error : new Error(String(error))
      return false
    } finally {
      isQueueing.value = false
    }
  }

  return {
    queuePrompt,
    isQueueing,
    lastError
  }
}
