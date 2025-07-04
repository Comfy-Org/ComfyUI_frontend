import { beforeEach, describe, expect, it, vi } from 'vitest'

import { newUserService } from '@/services/newUserService'

const mockLocalStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}))

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

vi.mock('@/config/version', () => ({
  __COMFYUI_FRONTEND_VERSION__: '1.24.0'
}))

//@ts-expect-error Define global for the test
global.__COMFYUI_FRONTEND_VERSION__ = '1.24.0'

describe('newUserService', () => {
  let service: ReturnType<typeof newUserService>
  let mockSettingStore: any

  beforeEach(() => {
    vi.clearAllMocks()
    service = newUserService()

    mockSettingStore = {
      settingValues: {},
      get: vi.fn(),
      set: vi.fn()
    }

    mockLocalStorage.getItem.mockReturnValue(null)
  })

  describe('checkIsNewUser logic', () => {
    it('should identify new user when all conditions are met', async () => {
      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(service.isNewUser()).toBe(true)
    })

    it('should identify new user when settings exist but TutorialCompleted is undefined', async () => {
      mockSettingStore.settingValues = { 'some.setting': 'value' }

      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })

      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(service.isNewUser()).toBe(true)
    })

    it('should identify existing user when tutorial is completed', async () => {
      mockSettingStore.settingValues = { 'Comfy.TutorialCompleted': true }
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return true
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(service.isNewUser()).toBe(false)
    })

    it('should identify existing user when workflow exists', async () => {
      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'workflow') return 'some-workflow'
        return null
      })

      await service.initializeIfNewUser(mockSettingStore)

      expect(service.isNewUser()).toBe(false)
    })

    it('should identify existing user when previous workflow exists', async () => {
      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'Comfy.PreviousWorkflow') return 'some-previous-workflow'
        return null
      })

      await service.initializeIfNewUser(mockSettingStore)

      expect(service.isNewUser()).toBe(false)
    })

    it('should identify new user when tutorial is explicitly false', async () => {
      mockSettingStore.settingValues = { 'Comfy.TutorialCompleted': false }
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return false
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(service.isNewUser()).toBe(true)
    })

    it('should identify existing user when has both settings and tutorial completed', async () => {
      mockSettingStore.settingValues = {
        'some.setting': 'value',
        'Comfy.TutorialCompleted': true
      }
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return true
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(service.isNewUser()).toBe(false)
    })

    it('should identify existing user when only one condition fails', async () => {
      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'workflow') return 'some-workflow'
        if (key === 'Comfy.PreviousWorkflow') return null
        return null
      })

      await service.initializeIfNewUser(mockSettingStore)

      expect(service.isNewUser()).toBe(false)
    })
  })

  describe('registerInitCallback', () => {
    it('should execute callback immediately if new user is already determined', async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined)

      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)
      expect(service.isNewUser()).toBe(true)

      await service.registerInitCallback(mockCallback)

      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('should queue callbacks when user status is not determined', async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined)

      await service.registerInitCallback(mockCallback)

      expect(mockCallback).not.toHaveBeenCalled()
      expect(service.isNewUser()).toBeNull()
    })

    it('should handle callback errors gracefully', async () => {
      const mockCallback = vi
        .fn()
        .mockRejectedValue(new Error('Callback error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      await service.registerInitCallback(mockCallback)

      expect(consoleSpy).toHaveBeenCalledWith(
        'New user initialization callback failed:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('initializeIfNewUser', () => {
    it('should set installed version for new users', async () => {
      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.InstalledVersion',
        '1.24.0'
      )
    })

    it('should not set installed version for existing users', async () => {
      mockSettingStore.settingValues = { 'some.setting': 'value' }
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return true
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(mockSettingStore.set).not.toHaveBeenCalled()
    })

    it('should execute pending callbacks for new users', async () => {
      const mockCallback1 = vi.fn().mockResolvedValue(undefined)
      const mockCallback2 = vi.fn().mockResolvedValue(undefined)

      await service.registerInitCallback(mockCallback1)
      await service.registerInitCallback(mockCallback2)

      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(mockCallback1).toHaveBeenCalledTimes(1)
      expect(mockCallback2).toHaveBeenCalledTimes(1)
    })

    it('should not execute pending callbacks for existing users', async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined)

      await service.registerInitCallback(mockCallback)

      mockSettingStore.settingValues = { 'some.setting': 'value' }
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return true
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should handle callback errors during initialization', async () => {
      const mockCallback = vi.fn().mockRejectedValue(new Error('Init error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await service.registerInitCallback(mockCallback)

      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(consoleSpy).toHaveBeenCalledWith(
        'New user initialization callback failed:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })

    it('should not reinitialize if already determined', async () => {
      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)
      expect(mockSettingStore.set).toHaveBeenCalledTimes(1)

      await service.initializeIfNewUser(mockSettingStore)
      expect(mockSettingStore.set).toHaveBeenCalledTimes(1)
    })

    it('should log new user status', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(consoleSpy).toHaveBeenCalledWith(
        'New user status determined: true'
      )
      consoleSpy.mockRestore()
    })
  })

  describe('isNewUser', () => {
    it('should return null before determination', () => {
      expect(service.isNewUser()).toBeNull()
    })

    it('should return cached result after determination', async () => {
      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockReturnValue(undefined)
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(service.isNewUser()).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle settingStore.get returning false as not completed', async () => {
      mockSettingStore.settingValues = { 'Comfy.TutorialCompleted': false }
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return false
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      expect(service.isNewUser()).toBe(true)
    })

    it('should handle multiple callback registrations after initialization', async () => {
      const mockCallback1 = vi.fn().mockResolvedValue(undefined)
      const mockCallback2 = vi.fn().mockResolvedValue(undefined)

      mockSettingStore.settingValues = {}
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.TutorialCompleted') return undefined
        return undefined
      })
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser(mockSettingStore)

      await service.registerInitCallback(mockCallback1)
      await service.registerInitCallback(mockCallback2)

      expect(mockCallback1).toHaveBeenCalledTimes(1)
      expect(mockCallback2).toHaveBeenCalledTimes(1)
    })
  })
})
