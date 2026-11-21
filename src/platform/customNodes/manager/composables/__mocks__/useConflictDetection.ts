import { vi } from 'vitest'

import type { useConflictDetection as realUseConflictDetection } from '@/platform/customNodes/manager/composables/useConflictDetection'

type ConflictDetection = ReturnType<typeof realUseConflictDetection>
type ConflictDetectionMock = Pick<
  ConflictDetection,
  'initializeConflictDetection'
>

export const useConflictDetection = vi.fn((): ConflictDetectionMock => ({
  initializeConflictDetection: vi.fn()
}))
