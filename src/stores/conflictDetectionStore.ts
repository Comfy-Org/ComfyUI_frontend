import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { ConflictDetectionResult } from '@/types/conflictDetectionTypes'

export const useConflictDetectionStore = defineStore(
  'conflictDetection',
  () => {
    // State
    const conflictedPackages = ref<ConflictDetectionResult[]>([])
    const isDetecting = ref(false)
    const lastDetectionTime = ref<string | null>(null)

    // Getters
    const hasConflicts = computed(() =>
      conflictedPackages.value.some((pkg) => pkg.has_conflict)
    )

    const getConflictsForPackage = computed(
      () => (packageId: string) =>
        conflictedPackages.value.find((pkg) => pkg.package_id === packageId)
    )

    const bannedPackages = computed(() =>
      conflictedPackages.value.filter((pkg) =>
        pkg.conflicts.some((conflict) => conflict.type === 'banned')
      )
    )

    const securityPendingPackages = computed(() =>
      conflictedPackages.value.filter((pkg) =>
        pkg.conflicts.some((conflict) => conflict.type === 'security_pending')
      )
    )

    // Actions
    function setConflictedPackages(packages: ConflictDetectionResult[]) {
      console.log(
        '[ConflictDetectionStore] Setting conflicted packages:',
        packages
      )
      conflictedPackages.value = [...packages]
      console.log(
        '[ConflictDetectionStore] conflictedPackages.value after set:',
        conflictedPackages.value
      )
    }

    function clearConflicts() {
      conflictedPackages.value = []
    }

    function setDetecting(detecting: boolean) {
      isDetecting.value = detecting
    }

    function setLastDetectionTime(time: string) {
      lastDetectionTime.value = time
    }

    return {
      // State
      conflictedPackages,
      isDetecting,
      lastDetectionTime,
      // Getters
      hasConflicts,
      getConflictsForPackage,
      bannedPackages,
      securityPendingPackages,
      // Actions
      setConflictedPackages,
      clearConflicts,
      setDetecting,
      setLastDetectionTime
    }
  }
)
