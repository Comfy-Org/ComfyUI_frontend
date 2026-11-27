import { vi } from 'vitest'
import { computed, readonly, ref } from 'vue'

import type { useConflictDetection as realUseConflictDetection } from '@/platform/customNodes/manager/composables/useConflictDetection'
import type {
  ConflictDetectionResult,
  SystemEnvironment
} from '@/platform/customNodes/manager/types/conflictDetectionTypes'

type ConflictDetection = ReturnType<typeof realUseConflictDetection>

const detectionResults = ref<ConflictDetectionResult[]>([])
const systemEnvironment = ref<SystemEnvironment | null>(null)

const conflictDetection: ConflictDetection = {
  isDetecting: readonly(ref(false)),
  lastDetectionTime: readonly(ref<string | null>(null)),
  detectionError: readonly(ref<string | null>(null)),
  systemEnvironment: readonly(systemEnvironment),
  detectionResults: readonly(detectionResults),
  hasConflicts: computed(() => false),
  conflictedPackages: computed(() => []),
  bannedPackages: computed(() => []),
  securityPendingPackages: computed(() => []),
  runFullConflictAnalysis: vi.fn<ConflictDetection['runFullConflictAnalysis']>(
    async () => ({ success: true, results: [] })
  ),
  collectSystemEnvironment: vi.fn<
    ConflictDetection['collectSystemEnvironment']
  >(async () => ({})),
  initializeConflictDetection: vi.fn<
    ConflictDetection['initializeConflictDetection']
  >(async () => {}),
  cancelRequests: vi.fn<ConflictDetection['cancelRequests']>(),
  shouldShowConflictModalAfterUpdate: vi.fn<
    ConflictDetection['shouldShowConflictModalAfterUpdate']
  >(async () => false),
  checkNodeCompatibility: vi.fn<ConflictDetection['checkNodeCompatibility']>(
    () => ({ hasConflict: false, conflicts: [] })
  )
}

export const useConflictDetection = vi.fn<typeof realUseConflictDetection>(
  () => conflictDetection
)
