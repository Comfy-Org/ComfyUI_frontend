import { computed } from 'vue'
import { onTestFinished, vi } from 'vitest'
import type { useManagerState as realUseManagerState } from '../useManagerState'

type ManagerState = ReturnType<typeof realUseManagerState>
type ManagerStateMock = Pick<
  ManagerState,
  'isNewManagerUI' | 'shouldShowManagerButtons' | 'openManager'
>

const actionDefaults: Pick<ManagerStateMock, 'openManager'> = {
  openManager: vi.fn(async () => {})
}

function createDefaultManagerState(): ManagerStateMock {
  return {
    isNewManagerUI: computed(() => false),
    shouldShowManagerButtons: computed(() => false),
    ...actionDefaults
  }
}

const managerState = createDefaultManagerState()
let cleanupRegistered = false

export const useManagerState = vi.fn(() => {
  if (!cleanupRegistered) {
    onTestFinished(() => {
      Object.assign(managerState, createDefaultManagerState())
      cleanupRegistered = false
    })
    cleanupRegistered = true
  }
  return managerState
})
