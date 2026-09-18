import { computed } from 'vue'
import { vi } from 'vitest'
import type { useManagerState as realUseManagerState } from '../useManagerState'

type ManagerState = ReturnType<typeof realUseManagerState>
type ManagerStateMock = Pick<
  ManagerState,
  'isNewManagerUI' | 'shouldShowManagerButtons' | 'openManager'
>

const managerState: ManagerStateMock = {
  isNewManagerUI: computed(() => false),
  shouldShowManagerButtons: computed(() => false),
  openManager: vi.fn(async () => {})
}

export const useManagerState = vi.fn(() => managerState)
