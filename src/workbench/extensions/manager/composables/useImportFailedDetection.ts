import { computed, unref } from 'vue'
import type { ComputedRef } from 'vue'

import { useDialogService } from '@/services/dialogService'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/workbench/extensions/manager/stores/conflictDetectionStore'
import type {
  ConflictDetail,
  ConflictDetectionResult
} from '@/workbench/extensions/manager/types/conflictDetectionTypes'

/**
 * Extracting import failed conflicts from conflict list
 */
function extractImportFailedConflicts(conflicts?: ConflictDetail[] | null) {
  if (!conflicts) return null

  const importFailedConflicts = conflicts.filter(
    (item): item is ConflictDetail => item.type === 'import_failed'
  )

  return importFailedConflicts.length > 0 ? importFailedConflicts : null
}

/**
 * Creating import failed dialog
 */
function createImportFailedDialog() {
  const { showImportFailedNodeDialog } = useDialogService()

  return (conflictedPackages: ConflictDetectionResult[] | null) => {
    if (conflictedPackages && conflictedPackages.length > 0) {
      showImportFailedNodeDialog({
        conflictedPackages
      })
    }
  }
}

/**
 * Composable for detecting and handling import failed conflicts
 * @param packageId - Package ID string or computed ref
 * @returns Object with import failed detection and dialog handler
 */
export function useImportFailedDetection(
  packageId?: string | ComputedRef<string> | null
) {
  const { isPackInstalled } = useComfyManagerStore()
  const { getConflictsForPackageByID } = useConflictDetectionStore()

  const isInstalled = computed(() =>
    packageId ? isPackInstalled(unref(packageId)) : false
  )

  const conflicts = computed(() => {
    const currentPackageId = unref(packageId)
    if (!currentPackageId || !isInstalled.value) return null
    return getConflictsForPackageByID(currentPackageId) || null
  })

  const importFailedInfo = computed(() => {
    return extractImportFailedConflicts(conflicts.value?.conflicts)
  })

  const importFailed = computed(() => {
    return importFailedInfo.value !== null
  })

  const showImportFailedDialog = createImportFailedDialog()

  return {
    importFailedInfo,
    importFailed,
    showImportFailedDialog: () => {
      if (conflicts.value) {
        showImportFailedDialog([conflicts.value])
      }
    },
    isInstalled
  }
}
