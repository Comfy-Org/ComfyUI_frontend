import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

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

import { useNewUserService } from '@/services/useNewUserService'

describe('useNewUserService', () => {
  let service: ReturnType<typeof useNewUserService>
  let scope: ReturnType<typeof effectScope>

  beforeEach(() => {
    vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())
    useSettingStore().settingValues = {}

    scope = effectScope()
    scope.run(() => {
      service = useNewUserService()
    })
    service.reset()

    mockLocalStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => scope.stop())

  describe('checkIsNewUser logic', () => {
    it('should identify new user when all conditions are met', async () => {
      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(true)
    })

    it('should identify new user when settings exist but TutorialCompleted is undefined', async () => {
      useSettingStore().settingValues = {
        'Comfy.ColorPalette': 'dark'
      }

      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined

      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(true)
    })

    it('should identify existing user when tutorial is completed', async () => {
      useSettingStore().settingValues = {
        'Comfy.TutorialCompleted': true
      }
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = true
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(false)
    })

    it('should identify existing user when workflow exists', async () => {
      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'workflow') return 'some-workflow'
        return null
      })

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(false)
    })

    it('should identify existing user when previous workflow exists', async () => {
      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'Comfy.PreviousWorkflow') return 'some-previous-workflow'
        return null
      })

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(false)
    })

    it('should identify existing user when V1 draft store keys exist', async () => {
      useSettingStore().settingValues = {}

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'Comfy.Workflow.Drafts') return '{}'
        return null
      })

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(false)
    })

    it('should identify existing user when V1 draft order key exists', async () => {
      useSettingStore().settingValues = {}

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'Comfy.Workflow.DraftOrder') return '[]'
        return null
      })

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(false)
    })

    it('should identify existing user when V2 draft index has entries', async () => {
      useSettingStore().settingValues = {}

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'Comfy.Workflow.DraftIndex.v2:personal')
          return '{"v":2,"updatedAt":1,"order":["abc"],"entries":{"abc":{"path":"workflows/Untitled.json","name":"Untitled","isTemporary":true,"updatedAt":1}}}'
        return null
      })

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(false)
    })

    it('should identify new user when V2 draft index exists but is empty', async () => {
      useSettingStore().settingValues = {}

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'Comfy.Workflow.DraftIndex.v2:personal')
          return '{"v":2,"updatedAt":1,"order":[],"entries":{}}'
        return null
      })

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(true)
    })

    it('should identify new user when V2 draft index is malformed', async () => {
      useSettingStore().settingValues = {}

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'Comfy.Workflow.DraftIndex.v2:personal') return 'not json'
        return null
      })

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(true)
    })

    it('should identify new user when tutorial is explicitly false', async () => {
      useSettingStore().settingValues = {
        'Comfy.TutorialCompleted': false
      }
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = false
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(true)
    })

    it('should identify existing user when has both settings and tutorial completed', async () => {
      useSettingStore().settingValues = {
        'Comfy.ColorPalette': 'dark',
        'Comfy.TutorialCompleted': true
      }
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = true
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(false)
    })

    it('should identify existing user when only one condition fails', async () => {
      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'workflow') return 'some-workflow'
        if (key === 'Comfy.PreviousWorkflow') return null
        return null
      })

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(false)
    })
  })

  describe('registerInitCallback', () => {
    it('should execute callback immediately if new user is already determined', async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined)

      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()
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

      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

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
      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(useSettingStore().set).toHaveBeenCalledWith(
        'Comfy.InstalledVersion',
        '1.24.0'
      )
    })

    it('should not set installed version for existing users', async () => {
      useSettingStore().settingValues = {
        'Comfy.ColorPalette': 'dark'
      }
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = true
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(useSettingStore().set).not.toHaveBeenCalled()
    })

    it('should execute pending callbacks for new users', async () => {
      const mockCallback1 = vi.fn().mockResolvedValue(undefined)
      const mockCallback2 = vi.fn().mockResolvedValue(undefined)

      await service.registerInitCallback(mockCallback1)
      await service.registerInitCallback(mockCallback2)

      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(mockCallback1).toHaveBeenCalledTimes(1)
      expect(mockCallback2).toHaveBeenCalledTimes(1)
    })

    it('should not execute pending callbacks for existing users', async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined)

      await service.registerInitCallback(mockCallback)

      useSettingStore().settingValues = {
        'Comfy.ColorPalette': 'dark'
      }
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = true
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should handle callback errors during initialization', async () => {
      const mockCallback = vi.fn().mockRejectedValue(new Error('Init error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await service.registerInitCallback(mockCallback)

      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(consoleSpy).toHaveBeenCalledWith(
        'New user initialization callback failed:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })

    it('should not reinitialize if already determined', async () => {
      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()
      expect(useSettingStore().set).toHaveBeenCalledTimes(1)

      await service.initializeIfNewUser()
      expect(useSettingStore().set).toHaveBeenCalledTimes(1)
    })

    it('should correctly determine new user status', async () => {
      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockReturnValue(null)

      expect(service.isNewUser()).toBeNull()

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(true)

      expect(useSettingStore().set).toHaveBeenCalledWith(
        'Comfy.InstalledVersion',
        expect.any(String)
      )
    })
  })

  describe('isNewUser', () => {
    it('should return null before determination', () => {
      expect(service.isNewUser()).toBeNull()
    })

    it('should return cached result after determination', async () => {
      useSettingStore().settingValues = {}

      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle settingStore.get returning false as not completed', async () => {
      useSettingStore().settingValues = {
        'Comfy.TutorialCompleted': false
      }
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = false
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      expect(service.isNewUser()).toBe(true)
    })

    it('should handle multiple callback registrations after initialization', async () => {
      const mockCallback1 = vi.fn().mockResolvedValue(undefined)
      const mockCallback2 = vi.fn().mockResolvedValue(undefined)

      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockReturnValue(null)

      await service.initializeIfNewUser()

      await service.registerInitCallback(mockCallback1)
      await service.registerInitCallback(mockCallback2)

      expect(mockCallback1).toHaveBeenCalledTimes(1)
      expect(mockCallback2).toHaveBeenCalledTimes(1)
    })
  })

  describe('state sharing between instances', () => {
    it('should share state between multiple service calls', async () => {
      const service1 = useNewUserService()
      const service2 = useNewUserService()

      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockReturnValue(null)

      await service1.initializeIfNewUser()

      expect(service2.isNewUser()).toBe(true)
      expect(service1.isNewUser()).toBe(service2.isNewUser())
    })

    it('should execute callbacks registered on different service calls', async () => {
      const service1 = useNewUserService()
      const service2 = useNewUserService()

      const mockCallback1 = vi.fn().mockResolvedValue(undefined)
      const mockCallback2 = vi.fn().mockResolvedValue(undefined)

      await service1.registerInitCallback(mockCallback1)
      await service2.registerInitCallback(mockCallback2)

      useSettingStore().settingValues = {}
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = undefined
      mockLocalStorage.getItem.mockReturnValue(null)

      await service1.initializeIfNewUser()

      expect(mockCallback1).toHaveBeenCalledTimes(1)
      expect(mockCallback2).toHaveBeenCalledTimes(1)
    })
  })
})
