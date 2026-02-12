import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useImportFailedDetection } from '@/workbench/extensions/manager/composables/useImportFailedDetection'
import * as importFailedNodeDialog from '@/workbench/extensions/manager/composables/useImportFailedNodeDialog'
import * as comfyManagerStore from '@/workbench/extensions/manager/stores/comfyManagerStore'
import * as conflictDetectionStore from '@/workbench/extensions/manager/stores/conflictDetectionStore'

// Mock the stores and services
vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore')
vi.mock('@/workbench/extensions/manager/stores/conflictDetectionStore')
vi.mock('@/workbench/extensions/manager/composables/useImportFailedNodeDialog')
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual('vue-i18n')
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
  let mockImportFailedNodeDialog: ReturnType<
    typeof importFailedNodeDialog.useImportFailedNodeDialog
  >

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    mockComfyManagerStore = {
      isPackInstalled: vi.fn()
    } as unknown as ReturnType<typeof comfyManagerStore.useComfyManagerStore>

    mockConflictDetectionStore = {
      getConflictsForPackageByID: vi.fn()
    } as unknown as ReturnType<
      typeof conflictDetectionStore.useConflictDetectionStore
    >

    mockImportFailedNodeDialog = {
      show: vi.fn()
    } as unknown as ReturnType<
      typeof importFailedNodeDialog.useImportFailedNodeDialog
    >

    vi.mocked(comfyManagerStore.useComfyManagerStore).mockReturnValue(
      mockComfyManagerStore
    )
    vi.mocked(conflictDetectionStore.useConflictDetectionStore).mockReturnValue(
      mockConflictDetectionStore
    )
    vi.mocked(importFailedNodeDialog.useImportFailedNodeDialog).mockReturnValue(
      mockImportFailedNodeDialog
    )
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

    expect(mockImportFailedNodeDialog.show).toHaveBeenCalledWith({
      conflictedPackages: expect.arrayContaining([
        expect.objectContaining({
          package_id: 'test-package',
          package_name: 'Test Package',
          conflicts: expect.arrayContaining([
            expect.objectContaining({
              type: 'import_failed'
            })
          ])
        })
      ]),
      dialogComponentProps: {
        onClose: undefined
      }
    })
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
