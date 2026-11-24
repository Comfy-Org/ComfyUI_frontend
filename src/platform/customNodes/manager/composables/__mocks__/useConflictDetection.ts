import { computed, readonly, ref } from 'vue'
import { vi } from 'vitest'

import type { useConflictDetection as realUseConflictDetection } from '@/platform/customNodes/manager/composables/useConflictDetection'

type ConflictDetection = ReturnType<typeof realUseConflictDetection>

const isDetecting = ref(false)
const lastDetectionTime = ref<string | null>(null)
const detectionError = ref<string | null>(null)
const systemEnvironment =
  ref<ConflictDetection['systemEnvironment']['value']>(null)
const detectionResults = ref<ConflictDetection['detectionResults']['value']>(
  []
) as ConflictDetection['detectionResults']

const conflictDetection: ConflictDetection = {
  isDetecting: readonly(isDetecting),
  lastDetectionTime: readonly(lastDetectionTime),
  detectionError: readonly(detectionError),
  systemEnvironment: readonly(systemEnvironment),
  detectionResults,
  hasConflicts: computed(() => false),
  conflictedPackages: computed(() => []),
  bannedPackages: computed(() => []),
  securityPendingPackages: computed(() => []),
  runFullConflictAnalysis: vi.fn(async () => ({
    success: true,
    conflicted_packages: []
  })) as unknown as ConflictDetection['runFullConflictAnalysis'],
  collectSystemEnvironment: vi.fn(
    async () => systemEnvironment.value
  ) as unknown as ConflictDetection['collectSystemEnvironment'],
  initializeConflictDetection: vi.fn(async () => {}),
  cancelRequests: vi.fn(),
  shouldShowConflictModalAfterUpdate: vi.fn(async () => false),
  checkNodeCompatibility: vi.fn(() => ({
    hasConflict: false,
    conflicts: []
  }))
}

export const useConflictDetection = vi.fn(() => conflictDetection)
