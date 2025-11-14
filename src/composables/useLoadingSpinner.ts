import { nextTick } from 'vue'

import { useWorkspaceStore } from '@/stores/workspaceStore'

export const withLoadingSpinner = async (
  work: () => void | Promise<void>,
  minDuration = 1000
) => {
  const workspaceStore = useWorkspaceStore()

  try {
    workspaceStore.spinner = true

    await new Promise((resolve) => setTimeout(resolve, 200))

    const startTime = Date.now()

    await work()

    // Wait for Vue updates and multiple paint cycles to ensure DOM widgets get positioned
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const elapsed = Date.now() - startTime
    const remaining = minDuration - elapsed

    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining))
    }
  } catch (error) {
    console.error('Error in withLoadingSpinner:', error)
    throw error
  } finally {
    workspaceStore.spinner = false
  }
}
