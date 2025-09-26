import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import * as dialogService from '@/services/dialogService'
import { useImportFailedDetection } from '@/workbench/extensions/manager/composables/useImportFailedDetection'
import * as comfyManagerStore from '@/workbench/extensions/manager/stores/comfyManagerStore'
import * as conflictDetectionStore from '@/workbench/extensions/manager/stores/conflictDetectionStore'

// Mock the stores and services
vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore')
vi.mock('@/workbench/extensions/manager/stores/conflictDetectionStore')
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
  let mockComfyManagerStore: ReturnType<
    typeof comfyManagerStore.useComfyManagerStore
  >
  let mockConflictDetectionStore: ReturnType<
    typeof conflictDetectionStore.useConflictDetectionStore
  >
  let mockDialogService: ReturnType<typeof dialogService.useDialogService>

  beforeEach(() => {
    setActivePinia(createPinia())

    mockComfyManagerStore = {
      isPackInstalled: vi.fn()
    } as unknown as ReturnType<typeof comfyManagerStore.useComfyManagerStore>

    mockConflictDetectionStore = {
      getConflictsForPackageByID: vi.fn()
    } as unknown as ReturnType<
      typeof conflictDetectionStore.useConflictDetectionStore
    >

    mockDialogService = {
      showErrorDialog: vi.fn()
    } as unknown as ReturnType<typeof dialogService.useDialogService>

    vi.mocked(comfyManagerStore.useComfyManagerStore).mockReturnValue(
      mockComfyManagerStore
    )
    vi.mocked(conflictDetectionStore.useConflictDetectionStore).mockReturnValue(
      mockConflictDetectionStore
    )
    vi.mocked(dialogService.useDialogService).mockReturnValue(mockDialogService)
  })

  it('should return false for importFailed when package is not installed', () => {
    vi.mocked(mockComfyManagerStore.isPackInstalled).mockReturnValue(false)

    const { importFailed } = useImportFailedDetection('test-package')

    expect(importFailed.value).toBe(false)
  })

  it('should return false for importFailed when no conflicts exist', () => {
    vi.mocked(mockComfyManagerStore.isPackInstalled).mockReturnValue(true)
    vi.mocked(
      mockConflictDetectionStore.getConflictsForPackageByID
    ).mockReturnValue(undefined)

    const { importFailed } = useImportFailedDetection('test-package')

    expect(importFailed.value).toBe(false)
  })

  it('should return false for importFailed when conflicts exist but no import_failed type', () => {
    vi.mocked(mockComfyManagerStore.isPackInstalled).mockReturnValue(true)
    vi.mocked(
      mockConflictDetectionStore.getConflictsForPackageByID
    ).mockReturnValue({
      package_id: 'test-package',
      package_name: 'Test Package',
      has_conflict: true,
      is_compatible: false,
      conflicts: [
        {
          type: 'comfyui_version',
          current_value: 'current',
          required_value: 'required'
        },
        {
          type: 'frontend_version',
          current_value: 'current',
          required_value: 'required'
        }
      ]
    })

    const { importFailed } = useImportFailedDetection('test-package')

    expect(importFailed.value).toBe(false)
  })

  it('should return true for importFailed when import_failed conflicts exist', () => {
    vi.mocked(mockComfyManagerStore.isPackInstalled).mockReturnValue(true)
    vi.mocked(
      mockConflictDetectionStore.getConflictsForPackageByID
    ).mockReturnValue({
      package_id: 'test-package',
      package_name: 'Test Package',
      has_conflict: true,
      is_compatible: false,
      conflicts: [
        {
          type: 'import_failed',
          current_value: 'current',
          required_value: 'Error details'
        },
        {
          type: 'comfyui_version',
          current_value: 'current',
          required_value: 'required'
        }
      ]
    })

    const { importFailed } = useImportFailedDetection('test-package')

    expect(importFailed.value).toBe(true)
  })

  it('should work with computed ref packageId', () => {
    const packageId = ref('test-package')
    vi.mocked(mockComfyManagerStore.isPackInstalled).mockReturnValue(true)
    vi.mocked(
      mockConflictDetectionStore.getConflictsForPackageByID
    ).mockReturnValue({
      package_id: 'test-package',
      package_name: 'Test Package',
      has_conflict: true,
      is_compatible: false,
      conflicts: [
        {
          type: 'import_failed',
          current_value: 'current',
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
    vi.mocked(
      mockConflictDetectionStore.getConflictsForPackageByID
    ).mockReturnValue(undefined)

    expect(importFailed.value).toBe(false)
  })

  it('should return correct importFailedInfo', () => {
    const importFailedConflicts = [
      {
        type: 'import_failed' as const,
        current_value: 'current',
        required_value: 'Error 1'
      },
      {
        type: 'import_failed' as const,
        current_value: 'current',
        required_value: 'Error 2'
      }
    ]

    vi.mocked(mockComfyManagerStore.isPackInstalled).mockReturnValue(true)
    vi.mocked(
      mockConflictDetectionStore.getConflictsForPackageByID
    ).mockReturnValue({
      package_id: 'test-package',
      package_name: 'Test Package',
      has_conflict: true,
      is_compatible: false,
      conflicts: [
        ...importFailedConflicts,
        {
          type: 'comfyui_version',
          current_value: 'current',
          required_value: 'required'
        }
      ]
    })

    const { importFailedInfo } = useImportFailedDetection('test-package')

    expect(importFailedInfo.value).toEqual(importFailedConflicts)
  })

  it('should show error dialog when showImportFailedDialog is called', () => {
    const importFailedConflicts = [
      {
        type: 'import_failed' as const,
        current_value: 'current',
        required_value: 'Error details'
      }
    ]

    vi.mocked(mockComfyManagerStore.isPackInstalled).mockReturnValue(true)
    vi.mocked(
      mockConflictDetectionStore.getConflictsForPackageByID
    ).mockReturnValue({
      package_id: 'test-package',
      package_name: 'Test Package',
      has_conflict: true,
      is_compatible: false,
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
