import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useImportFailedDetection } from '@/composables/useImportFailedDetection'
import * as dialogService from '@/services/dialogService'
import * as comfyManagerStore from '@/stores/comfyManagerStore'
import * as conflictDetectionStore from '@/stores/conflictDetectionStore'

// Mock the stores and services
vi.mock('@/stores/comfyManagerStore')
vi.mock('@/stores/conflictDetectionStore')
vi.mock('@/services/dialogService')
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: vi.fn((key: string) => key)
    })
  }
})

describe('useImportFailedDetection', () => {
  let mockComfyManagerStore: any
  let mockConflictDetectionStore: any
  let mockDialogService: any

  beforeEach(() => {
    setActivePinia(createPinia())

    mockComfyManagerStore = {
      isPackInstalled: vi.fn()
    }
    mockConflictDetectionStore = {
      getConflictsForPackageByID: vi.fn()
    }
    mockDialogService = {
      showErrorDialog: vi.fn()
    }

    vi.mocked(comfyManagerStore.useComfyManagerStore).mockReturnValue(
      mockComfyManagerStore
    )
    vi.mocked(conflictDetectionStore.useConflictDetectionStore).mockReturnValue(
      mockConflictDetectionStore
    )
    vi.mocked(dialogService.useDialogService).mockReturnValue(mockDialogService)
  })

  it('should return false for importFailed when package is not installed', () => {
    mockComfyManagerStore.isPackInstalled.mockReturnValue(false)

    const { importFailed } = useImportFailedDetection('test-package')

    expect(importFailed.value).toBe(false)
  })

  it('should return false for importFailed when no conflicts exist', () => {
    mockComfyManagerStore.isPackInstalled.mockReturnValue(true)
    mockConflictDetectionStore.getConflictsForPackageByID.mockReturnValue(null)

    const { importFailed } = useImportFailedDetection('test-package')

    expect(importFailed.value).toBe(false)
  })

  it('should return false for importFailed when conflicts exist but no import_failed type', () => {
    mockComfyManagerStore.isPackInstalled.mockReturnValue(true)
    mockConflictDetectionStore.getConflictsForPackageByID.mockReturnValue({
      package_id: 'test-package',
      conflicts: [
        { type: 'dependency', message: 'Dependency conflict' },
        { type: 'version', message: 'Version conflict' }
      ]
    })

    const { importFailed } = useImportFailedDetection('test-package')

    expect(importFailed.value).toBe(false)
  })

  it('should return true for importFailed when import_failed conflicts exist', () => {
    mockComfyManagerStore.isPackInstalled.mockReturnValue(true)
    mockConflictDetectionStore.getConflictsForPackageByID.mockReturnValue({
      package_id: 'test-package',
      conflicts: [
        {
          type: 'import_failed',
          message: 'Import failed',
          required_value: 'Error details'
        },
        { type: 'dependency', message: 'Dependency conflict' }
      ]
    })

    const { importFailed } = useImportFailedDetection('test-package')

    expect(importFailed.value).toBe(true)
  })

  it('should work with computed ref packageId', () => {
    const packageId = ref('test-package')
    mockComfyManagerStore.isPackInstalled.mockReturnValue(true)
    mockConflictDetectionStore.getConflictsForPackageByID.mockReturnValue({
      package_id: 'test-package',
      conflicts: [
        {
          type: 'import_failed',
          message: 'Import failed',
          required_value: 'Error details'
        }
      ]
    })

    const { importFailed } = useImportFailedDetection(
      computed(() => packageId.value)
    )

    expect(importFailed.value).toBe(true)

    // Change packageId
    packageId.value = 'another-package'
    mockConflictDetectionStore.getConflictsForPackageByID.mockReturnValue(null)

    expect(importFailed.value).toBe(false)
  })

  it('should return correct importFailedInfo', () => {
    const importFailedConflicts = [
      {
        type: 'import_failed',
        message: 'Import failed 1',
        required_value: 'Error 1'
      },
      {
        type: 'import_failed',
        message: 'Import failed 2',
        required_value: 'Error 2'
      }
    ]

    mockComfyManagerStore.isPackInstalled.mockReturnValue(true)
    mockConflictDetectionStore.getConflictsForPackageByID.mockReturnValue({
      package_id: 'test-package',
      conflicts: [
        ...importFailedConflicts,
        { type: 'dependency', message: 'Dependency conflict' }
      ]
    })

    const { importFailedInfo } = useImportFailedDetection('test-package')

    expect(importFailedInfo.value).toEqual(importFailedConflicts)
  })

  it('should show error dialog when showImportFailedDialog is called', () => {
    const importFailedConflicts = [
      {
        type: 'import_failed',
        message: 'Import failed',
        required_value: 'Error details'
      }
    ]

    mockComfyManagerStore.isPackInstalled.mockReturnValue(true)
    mockConflictDetectionStore.getConflictsForPackageByID.mockReturnValue({
      package_id: 'test-package',
      conflicts: importFailedConflicts
    })

    const { showImportFailedDialog } = useImportFailedDetection('test-package')

    showImportFailedDialog()

    expect(mockDialogService.showErrorDialog).toHaveBeenCalledWith(
      expect.any(Error),
      {
        title: 'manager.failedToInstall',
        reportType: 'importFailedError'
      }
    )
  })

  it('should handle null packageId', () => {
    const { importFailed, isInstalled } = useImportFailedDetection(null)

    expect(importFailed.value).toBe(false)
    expect(isInstalled.value).toBe(false)
  })

  it('should handle undefined packageId', () => {
    const { importFailed, isInstalled } = useImportFailedDetection(undefined)

    expect(importFailed.value).toBe(false)
    expect(isInstalled.value).toBe(false)
  })
})
