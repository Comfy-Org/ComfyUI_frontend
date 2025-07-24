import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useConflictAcknowledgment } from '@/composables/useConflictAcknowledgment'

describe('useConflictAcknowledgment', () => {
  // Mock localStorage
  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  }

  beforeEach(() => {
    // Reset localStorage mock
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
    mockLocalStorage.removeItem.mockClear()
    mockLocalStorage.clear.mockClear()

    // Mock localStorage globally
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    })

    // Default mock returns
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state loading', () => {
    it('should load empty state when localStorage is empty', () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { acknowledgmentState } = useConflictAcknowledgment()

      expect(acknowledgmentState.value).toEqual({
        modal_dismissed: false,
        red_dot_dismissed: false,
        acknowledged_conflicts: [],
        last_comfyui_version: ''
      })
    })

    it('should load existing state from localStorage', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'comfyui.conflict.modal.dismissed':
            return 'true'
          case 'comfyui.conflict.red_dot.dismissed':
            return 'true'
          case 'comfyui.conflict.acknowledged':
            return JSON.stringify([
              {
                package_id: 'TestPackage',
                conflict_type: 'os',
                timestamp: '2023-01-01T00:00:00.000Z',
                comfyui_version: '0.3.41'
              }
            ])
          case 'comfyui.last_version':
            return '0.3.41'
          default:
            return null
        }
      })

      const { acknowledgmentState } = useConflictAcknowledgment()

      expect(acknowledgmentState.value).toEqual({
        modal_dismissed: true,
        red_dot_dismissed: true,
        acknowledged_conflicts: [
          {
            package_id: 'TestPackage',
            conflict_type: 'os',
            timestamp: '2023-01-01T00:00:00.000Z',
            comfyui_version: '0.3.41'
          }
        ],
        last_comfyui_version: '0.3.41'
      })
    })

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'comfyui.conflict.acknowledged') {
          return 'invalid-json'
        }
        return null
      })

      // Mock console.warn to avoid test output pollution
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      const { acknowledgmentState } = useConflictAcknowledgment()

      expect(acknowledgmentState.value).toEqual({
        modal_dismissed: false,
        red_dot_dismissed: false,
        acknowledged_conflicts: [],
        last_comfyui_version: ''
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ConflictAcknowledgment] Failed to load acknowledgment state from localStorage:',
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe('ComfyUI version change detection', () => {
    it('should detect version change and reset state', () => {
      // Setup existing state
      mockLocalStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'comfyui.conflict.modal.dismissed':
            return 'true'
          case 'comfyui.conflict.red_dot.dismissed':
            return 'true'
          case 'comfyui.last_version':
            return '0.3.40'
          default:
            return null
        }
      })

      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {})

      const { checkComfyUIVersionChange, acknowledgmentState } =
        useConflictAcknowledgment()

      const versionChanged = checkComfyUIVersionChange('0.3.41')

      expect(versionChanged).toBe(true)
      expect(acknowledgmentState.value.modal_dismissed).toBe(false)
      expect(acknowledgmentState.value.red_dot_dismissed).toBe(false)
      expect(acknowledgmentState.value.last_comfyui_version).toBe('0.3.41')

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('ComfyUI version changed from 0.3.40 to 0.3.41')
      )

      consoleLogSpy.mockRestore()
    })

    it('should not detect version change for same version', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'comfyui.last_version') {
          return '0.3.41'
        }
        return null
      })

      const { checkComfyUIVersionChange } = useConflictAcknowledgment()

      const versionChanged = checkComfyUIVersionChange('0.3.41')

      expect(versionChanged).toBe(false)
    })

    it('should handle first run (no previous version)', () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { checkComfyUIVersionChange } = useConflictAcknowledgment()

      const versionChanged = checkComfyUIVersionChange('0.3.41')

      expect(versionChanged).toBe(false)
    })
  })

  describe('modal dismissal', () => {
    it('should dismiss conflict modal and save to localStorage', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {})

      const { dismissConflictModal, acknowledgmentState } =
        useConflictAcknowledgment()

      dismissConflictModal()

      expect(acknowledgmentState.value.modal_dismissed).toBe(true)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'comfy_manager_conflict_banner_dismissed',
        'true'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConflictAcknowledgment] Conflict modal dismissed'
      )

      consoleLogSpy.mockRestore()
    })

    it('should dismiss red dot notification and save to localStorage', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {})

      const { dismissRedDotNotification, acknowledgmentState } =
        useConflictAcknowledgment()

      dismissRedDotNotification()

      expect(acknowledgmentState.value.red_dot_dismissed).toBe(true)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'comfy_help_center_conflict_seen',
        'true'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConflictAcknowledgment] Red dot notification dismissed'
      )

      consoleLogSpy.mockRestore()
    })
  })

  describe('conflict acknowledgment', () => {
    it('should acknowledge a conflict and save to localStorage', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {})
      const dateSpy = vi
        .spyOn(Date.prototype, 'toISOString')
        .mockReturnValue('2023-01-01T00:00:00.000Z')

      const { acknowledgeConflict, acknowledgmentState } =
        useConflictAcknowledgment()

      acknowledgeConflict('TestPackage', 'os', '0.3.41')

      expect(acknowledgmentState.value.acknowledged_conflicts).toHaveLength(1)
      expect(acknowledgmentState.value.acknowledged_conflicts[0]).toEqual({
        package_id: 'TestPackage',
        conflict_type: 'os',
        timestamp: '2023-01-01T00:00:00.000Z',
        comfyui_version: '0.3.41'
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'comfy_conflict_acknowledged',
        JSON.stringify([
          {
            package_id: 'TestPackage',
            conflict_type: 'os',
            timestamp: '2023-01-01T00:00:00.000Z',
            comfyui_version: '0.3.41'
          }
        ])
      )

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConflictAcknowledgment] Acknowledged conflict for TestPackage:os'
      )

      dateSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    it('should replace existing acknowledgment for same package and conflict type', () => {
      const { acknowledgeConflict, acknowledgmentState } =
        useConflictAcknowledgment()

      // First acknowledgment
      acknowledgeConflict('TestPackage', 'os', '0.3.41')
      expect(acknowledgmentState.value.acknowledged_conflicts).toHaveLength(1)

      // Second acknowledgment for same package and conflict type
      acknowledgeConflict('TestPackage', 'os', '0.3.42')
      expect(acknowledgmentState.value.acknowledged_conflicts).toHaveLength(1)
      expect(
        acknowledgmentState.value.acknowledged_conflicts[0].comfyui_version
      ).toBe('0.3.42')
    })

    it('should allow multiple acknowledgments for different conflict types', () => {
      const { acknowledgeConflict, acknowledgmentState } =
        useConflictAcknowledgment()

      acknowledgeConflict('TestPackage', 'os', '0.3.41')
      acknowledgeConflict('TestPackage', 'accelerator', '0.3.41')

      expect(acknowledgmentState.value.acknowledged_conflicts).toHaveLength(2)
    })
  })

  describe('conflict checking', () => {
    it('should check if conflict is acknowledged', () => {
      const { acknowledgeConflict, isConflictAcknowledged } =
        useConflictAcknowledgment()

      // Initially not acknowledged
      expect(isConflictAcknowledged('TestPackage', 'os')).toBe(false)

      // After acknowledgment
      acknowledgeConflict('TestPackage', 'os', '0.3.41')
      expect(isConflictAcknowledged('TestPackage', 'os')).toBe(true)

      // Different conflict type should not be acknowledged
      expect(isConflictAcknowledged('TestPackage', 'accelerator')).toBe(false)
    })

    it('should remove conflict acknowledgment', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {})

      const {
        acknowledgeConflict,
        removeConflictAcknowledgment,
        isConflictAcknowledged,
        acknowledgmentState
      } = useConflictAcknowledgment()

      // Add acknowledgment
      acknowledgeConflict('TestPackage', 'os', '0.3.41')
      expect(isConflictAcknowledged('TestPackage', 'os')).toBe(true)

      // Remove acknowledgment
      removeConflictAcknowledgment('TestPackage', 'os')
      expect(isConflictAcknowledged('TestPackage', 'os')).toBe(false)
      expect(acknowledgmentState.value.acknowledged_conflicts).toHaveLength(0)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConflictAcknowledgment] Removed acknowledgment for TestPackage:os'
      )

      consoleLogSpy.mockRestore()
    })
  })

  describe('computed properties', () => {
    it('should calculate shouldShowConflictModal correctly', () => {
      const { shouldShowConflictModal, dismissConflictModal } =
        useConflictAcknowledgment()

      expect(shouldShowConflictModal.value).toBe(true)

      dismissConflictModal()
      expect(shouldShowConflictModal.value).toBe(false)
    })

    it('should calculate shouldShowRedDot correctly', () => {
      const { shouldShowRedDot, dismissRedDotNotification } =
        useConflictAcknowledgment()

      expect(shouldShowRedDot.value).toBe(true)

      dismissRedDotNotification()
      expect(shouldShowRedDot.value).toBe(false)
    })

    it('should calculate acknowledgedPackageIds correctly', () => {
      const { acknowledgeConflict, acknowledgedPackageIds } =
        useConflictAcknowledgment()

      expect(acknowledgedPackageIds.value).toEqual([])

      acknowledgeConflict('Package1', 'os', '0.3.41')
      acknowledgeConflict('Package2', 'accelerator', '0.3.41')
      acknowledgeConflict('Package1', 'accelerator', '0.3.41') // Same package, different conflict

      expect(acknowledgedPackageIds.value).toEqual(['Package1', 'Package2'])
    })

    it('should calculate acknowledgmentStats correctly', () => {
      const { acknowledgeConflict, dismissConflictModal, acknowledgmentStats } =
        useConflictAcknowledgment()

      acknowledgeConflict('Package1', 'os', '0.3.41')
      acknowledgeConflict('Package2', 'accelerator', '0.3.41')
      dismissConflictModal()

      expect(acknowledgmentStats.value).toEqual({
        total_acknowledged: 2,
        unique_packages: 2,
        modal_dismissed: true,
        red_dot_dismissed: false,
        last_comfyui_version: ''
      })
    })
  })

  describe('clear functionality', () => {
    it('should clear all acknowledgments', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {})

      const {
        acknowledgeConflict,
        dismissConflictModal,
        clearAllAcknowledgments,
        acknowledgmentState
      } = useConflictAcknowledgment()

      // Add some data
      acknowledgeConflict('Package1', 'os', '0.3.41')
      dismissConflictModal()

      // Clear all
      clearAllAcknowledgments()

      expect(acknowledgmentState.value).toEqual({
        modal_dismissed: false,
        red_dot_dismissed: false,
        acknowledged_conflicts: [],
        last_comfyui_version: ''
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConflictAcknowledgment] Cleared all acknowledgments'
      )

      consoleLogSpy.mockRestore()
    })
  })

  describe('localStorage error handling', () => {
    it('should handle localStorage setItem errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage full')
      })

      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      const { dismissConflictModal } = useConflictAcknowledgment()

      dismissConflictModal() // Should not throw

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ConflictAcknowledgment] Failed to save acknowledgment state to localStorage:',
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })
  })
})
