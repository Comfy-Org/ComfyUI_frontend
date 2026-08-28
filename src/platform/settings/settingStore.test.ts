import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getSettingInfo,
  useSettingStore
} from '@/platform/settings/settingStore'
import type { SettingParams } from '@/platform/settings/types'
import type { Settings } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

const { trackSettingChanged } = vi.hoisted(() => ({
  trackSettingChanged: vi.fn()
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackSettingChanged
  }))
}))

// Mock the api
vi.mock('@/scripts/api', () => ({
  api: {
    getSettings: vi.fn(),
    storeSetting: vi.fn(),
    storeSettings: vi.fn()
  }
}))

// Mock the app
vi.mock('@/scripts/app', () => ({
  app: {
    ui: {
      settings: {
        dispatchChange: vi.fn()
      }
    }
  }
}))

describe('useSettingStore', () => {
  let store: ReturnType<typeof useSettingStore>

  beforeEach(() => {
    store = useSettingStore()
  })

  it('should initialize with empty settings', () => {
    expect(store.settingValues).toEqual({})
    expect(store.settingsById).toEqual({})
  })

  describe('load', () => {
    it('should load settings from API', async () => {
      const mockSettings = { 'test.setting': 'value' }
      vi.mocked(api.getSettings).mockResolvedValue(
        mockSettings as Partial<Settings> as Settings
      )

      await store.load()

      expect(store.settingValues).toEqual(mockSettings)
      expect(api.getSettings).toHaveBeenCalled()
    })

    describe('Canvas Navigation override migration', () => {
      const NAV = 'Comfy.Canvas.NavigationMode'
      const LEFT = 'Comfy.Canvas.LeftMouseClickBehavior'
      const WHEEL = 'Comfy.Canvas.MouseWheelScroll'

      const loadWith = async (persisted: Record<string, unknown>) => {
        vi.mocked(api.getSettings).mockResolvedValue(persisted as Settings)
        await store.load()
      }

      it('supplies both overrides for a stored preset', async () => {
        await loadWith({ [NAV]: 'standard' })

        expect(api.storeSettings).toHaveBeenCalledWith({
          [LEFT]: 'select',
          [WHEEL]: 'panning'
        })
        expect(store.settingValues).toMatchObject({
          [NAV]: 'standard',
          [LEFT]: 'select',
          [WHEEL]: 'panning'
        })
      })

      it('supplies only the override that is missing', async () => {
        await loadWith({ [NAV]: 'standard', [WHEEL]: 'zoom' })

        expect(api.storeSettings).toHaveBeenCalledWith({ [LEFT]: 'select' })
        expect(store.settingValues[WHEEL]).toBe('zoom')
      })

      it('leaves a stored custom mode alone', async () => {
        await loadWith({ [NAV]: 'custom' })

        expect(api.storeSettings).not.toHaveBeenCalled()
        expect(store.settingValues[LEFT]).toBeUndefined()
      })

      it('leaves a profile with both overrides alone', async () => {
        await loadWith({
          [NAV]: 'legacy',
          [LEFT]: 'select',
          [WHEEL]: 'panning'
        })

        expect(api.storeSettings).not.toHaveBeenCalled()
      })

      it('writes nothing for a profile with no stored mode', async () => {
        await loadWith({})

        expect(api.storeSettings).not.toHaveBeenCalled()
      })

      // GraphCanvas rethrows `error` before registering any core setting, so a
      // rejection here would leave the app unable to start.
      it('leaves the store loadable when the write fails', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.mocked(api.storeSettings).mockRejectedValue(new Error('offline'))

        await loadWith({ [NAV]: 'standard' })

        expect(store.error).toBeUndefined()
        expect(store.isReady).toBe(true)
        expect(store.settingValues[LEFT]).toBe('select')
      })
    })

    it('leaves the store loadable when the zoom threshold write fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(api.storeSetting).mockRejectedValue(new Error('offline'))
      vi.mocked(api.getSettings).mockResolvedValue({
        'LiteGraph.Canvas.LowQualityRenderingZoomThreshold': 0.6
      } as Partial<Settings> as Settings)

      await store.load()

      expect(store.error).toBeUndefined()
      expect(store.isReady).toBe(true)
      expect(store.settingValues['LiteGraph.Canvas.MinFontSizeForLOD']).toBe(8)
    })

    it('should set error if settings are loaded after registration', async () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default'
      }
      store.addSetting(setting)

      await store.load()

      expect(store.error).toBeInstanceOf(Error)
      if (store.error instanceof Error) {
        expect(store.error.message).toBe(
          'Setting values must be loaded before any setting is registered.'
        )
      }
    })
  })

  describe('addSetting', () => {
    it('should register a new setting', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default'
      }

      store.addSetting(setting)

      expect(store.settingsById['test.setting']).toEqual(setting)
    })

    it('should warn and skip for duplicate setting ID', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default'
      }
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      store.addSetting(setting)
      store.addSetting(setting)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Setting already registered: test.setting'
      )
      consoleWarnSpy.mockRestore()
    })

    it('should migrate deprecated values', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default',
        migrateDeprecatedValue: (val: unknown) => (val as string).toUpperCase()
      }

      store.settingValues['test.setting'] = 'oldvalue'
      store.addSetting(setting)

      expect(store.settingValues['test.setting']).toBe('OLDVALUE')
    })
  })

  describe('getDefaultValue', () => {
    beforeEach(() => {
      // Set up installed version for most tests
      store.settingValues['Comfy.InstalledVersion'] = '1.30.0'
    })

    it('should return regular default value when no defaultsByInstallVersion', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default'
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('test.setting')
      expect(result).toBe('regular-default')
    })

    it('should return versioned default when user version matches', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('test.setting')
      // installedVersion is 1.30.0, so should get 1.21.3 default
      expect(result).toBe('version-1.21.3-default')
    })

    it('should return latest versioned default when user version is higher', () => {
      store.settingValues['Comfy.InstalledVersion'] = '1.50.0'

      const setting: SettingParams = {
        id: 'test.setting',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('test.setting')
      // installedVersion is 1.50.0, so should get 1.40.3 default
      expect(result).toBe('version-1.40.3-default')
    })

    it('should return regular default when user version is lower than all versioned defaults', () => {
      store.settingValues['Comfy.InstalledVersion'] = '1.10.0'

      const setting: SettingParams = {
        id: 'test.setting',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('test.setting')
      // installedVersion is 1.10.0, lower than all versioned defaults
      expect(result).toBe('regular-default')
    })

    it('should return regular default when no installed version (existing users)', () => {
      // Clear installed version to simulate existing user
      delete store.settingValues['Comfy.InstalledVersion']

      const setting: SettingParams = {
        id: 'test.setting',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('test.setting')
      // No installed version, should use backward compatibility
      expect(result).toBe('regular-default')
    })

    it('should handle function-based versioned defaults', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': () => 'dynamic-version-1.21.3-default',
          '1.40.3': () => 'dynamic-version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('test.setting')
      // installedVersion is 1.30.0, so should get 1.21.3 default (executed)
      expect(result).toBe('dynamic-version-1.21.3-default')
    })

    it('should handle function-based regular defaults with versioned defaults', () => {
      store.settingValues['Comfy.InstalledVersion'] = '1.10.0'

      const setting: SettingParams = {
        id: 'test.setting',
        name: 'Test Setting',
        type: 'text',
        defaultValue: () => 'dynamic-regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('test.setting')
      // installedVersion is 1.10.0, should fallback to function-based regular default
      expect(result).toBe('dynamic-regular-default')
    })

    it('should handle complex version comparison correctly', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.21.10': 'version-1.21.10-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      // Test with 1.21.5 - should get 1.21.3 default
      store.settingValues['Comfy.InstalledVersion'] = '1.21.5'
      expect(store.getDefaultValue('test.setting')).toBe(
        'version-1.21.3-default'
      )

      // Test with 1.21.15 - should get 1.21.10 default
      store.settingValues['Comfy.InstalledVersion'] = '1.21.15'
      expect(store.getDefaultValue('test.setting')).toBe(
        'version-1.21.10-default'
      )

      // Test with 1.21.3 exactly - should get 1.21.3 default
      store.settingValues['Comfy.InstalledVersion'] = '1.21.3'
      expect(store.getDefaultValue('test.setting')).toBe(
        'version-1.21.3-default'
      )
    })

    it('should work with get() method using versioned defaults', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      // get() should use getDefaultValue internally
      const result = store.get('test.setting')
      expect(result).toBe('version-1.21.3-default')
    })

    it('should handle mixed function and static versioned defaults', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': () => 'dynamic-1.21.3-default',
          '1.40.3': 'static-1.40.3-default'
        }
      }
      store.addSetting(setting)

      // Test with 1.30.0 - should get dynamic 1.21.3 default
      store.settingValues['Comfy.InstalledVersion'] = '1.30.0'
      expect(store.getDefaultValue('test.setting')).toBe(
        'dynamic-1.21.3-default'
      )

      // Test with 1.50.0 - should get static 1.40.3 default
      store.settingValues['Comfy.InstalledVersion'] = '1.50.0'
      expect(store.getDefaultValue('test.setting')).toBe(
        'static-1.40.3-default'
      )
    })

    it('should handle version sorting correctly', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.40.3': 'version-1.40.3-default',
          '1.21.3': 'version-1.21.3-default', // Unsorted order
          '1.35.0': 'version-1.35.0-default'
        }
      }
      store.addSetting(setting)

      // Test with 1.37.0 - should get 1.35.0 default (highest version <= 1.37.0)
      store.settingValues['Comfy.InstalledVersion'] = '1.37.0'
      expect(store.getDefaultValue('test.setting')).toBe(
        'version-1.35.0-default'
      )
    })
  })

  describe('get and set', () => {
    it('should get default value when setting not exists', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default'
      }
      store.addSetting(setting)

      expect(store.get('test.setting')).toBe('default')
    })

    it('should set value and trigger onChange', async () => {
      const onChangeMock = vi.fn()
      const dispatchChangeMock = vi.mocked(app.ui.settings.dispatchChange)
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default',
        onChange: onChangeMock
      }
      store.addSetting(setting)
      // Adding the new setting should trigger onChange
      expect(onChangeMock).toHaveBeenCalledTimes(1)
      expect(dispatchChangeMock).toHaveBeenCalledTimes(1)

      await store.set('test.setting', 'newvalue')

      expect(store.get('test.setting')).toBe('newvalue')
      expect(onChangeMock).toHaveBeenCalledWith('newvalue', 'default')
      expect(onChangeMock).toHaveBeenCalledTimes(2)
      expect(dispatchChangeMock).toHaveBeenCalledTimes(2)
      expect(api.storeSetting).toHaveBeenCalledWith('test.setting', 'newvalue')

      // Set a different value, it should trigger onChange
      await store.set('test.setting', 'differentvalue')
      expect(onChangeMock).toHaveBeenCalledWith('differentvalue', 'newvalue')
      expect(onChangeMock).toHaveBeenCalledTimes(3)
      expect(dispatchChangeMock).toHaveBeenCalledTimes(3)
      expect(api.storeSetting).toHaveBeenCalledWith(
        'test.setting',
        'differentvalue'
      )
    })

    it('awaits an onChange handler before persisting the value', async () => {
      const order: string[] = []
      vi.mocked(api.storeSetting).mockImplementation(async () => {
        order.push('storeSetting')
        return new Response()
      })
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default',
        onChange: async (_value, old) => {
          if (!old) return
          await Promise.resolve()
          order.push('onChange')
        }
      })

      await store.set('test.setting', 'newvalue')

      expect(order).toEqual(['onChange', 'storeSetting'])
    })

    // onChange is extension-facing, and set() persists only after awaiting it,
    // so an unisolated failure would discard the user's change unsaved.
    it.for([
      {
        label: 'rejects',
        onChange: async () => {
          throw new Error('extension blew up')
        }
      },
      {
        label: 'throws synchronously',
        onChange: () => {
          throw new Error('extension blew up')
        }
      }
    ])('persists the value when a handler $label', async ({ onChange }) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default',
        onChange
      })

      await expect(
        store.set('test.setting', 'newvalue')
      ).resolves.toBeUndefined()

      expect(api.storeSetting).toHaveBeenCalledWith('test.setting', 'newvalue')
      expect(store.get('test.setting')).toBe('newvalue')
    })

    it('does not persist a value a newer set() has superseded', async () => {
      let releaseFirst = () => {}
      const firstHandlerGate = new Promise<void>((resolve) => {
        releaseFirst = resolve
      })
      let isFirstChange = true
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default',
        onChange: async (_value, old) => {
          if (!old || !isFirstChange) return
          isFirstChange = false
          await firstHandlerGate
        }
      })

      const stalled = store.set('test.setting', 'first')
      await store.set('test.setting', 'second')
      releaseFirst()
      await stalled

      expect(store.get('test.setting')).toBe('second')
      expect(api.storeSetting).toHaveBeenLastCalledWith(
        'test.setting',
        'second'
      )
    })

    it('exposes the new value to onChange handlers', async () => {
      const observed: unknown[] = []
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default',
        onChange: () => {
          observed.push(store.get('test.setting'))
        }
      })

      await store.set('test.setting', 'newvalue')

      expect(observed).toEqual(['default', 'newvalue'])
    })

    it('tracks visible settings with values by default', async () => {
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default'
      })

      await store.set('test.setting', 'newvalue')

      expect(trackSettingChanged).toHaveBeenCalledWith({
        setting_id: 'test.setting',
        previous_value: 'default',
        new_value: 'newvalue'
      })
    })

    it('does not track hidden settings by default', async () => {
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'hidden',
        defaultValue: 'default'
      })

      await store.set('test.setting', 'newvalue')

      expect(trackSettingChanged).not.toHaveBeenCalled()
    })

    it('does not track visible settings that opt out', async () => {
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default',
        telemetry: { trackChanges: false }
      })

      await store.set('test.setting', 'newvalue')

      expect(trackSettingChanged).not.toHaveBeenCalled()
    })

    it('tracks visible settings without values when values opt out', async () => {
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default',
        telemetry: { includeValues: false }
      })

      await store.set('test.setting', 'newvalue')

      expect(trackSettingChanged).toHaveBeenCalledWith({
        setting_id: 'test.setting'
      })
    })

    it('tracks hidden settings that opt in, without shipping values by default', async () => {
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'hidden',
        defaultValue: 'default',
        telemetry: { trackChanges: true }
      })

      await store.set('test.setting', 'newvalue')
      expect(trackSettingChanged).toHaveBeenCalledWith({
        setting_id: 'test.setting'
      })

      // Setting the same value again is a no-op and should not re-emit
      await store.set('test.setting', 'newvalue')
      expect(trackSettingChanged).toHaveBeenCalledTimes(1)
    })

    it('ships previous/new values when the setting opts into includeValues', async () => {
      store.addSetting({
        id: 'Comfy.ColorPalette',
        name: 'The active color palette id',
        type: 'hidden',
        defaultValue: 'dark',
        telemetry: { trackChanges: true, includeValues: true }
      })

      await store.set('Comfy.ColorPalette', 'light')

      expect(trackSettingChanged).toHaveBeenCalledWith({
        setting_id: 'Comfy.ColorPalette',
        previous_value: 'dark',
        new_value: 'light'
      })
    })

    it('does not track telemetry when persistence fails', async () => {
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default',
        telemetry: { trackChanges: true }
      })
      vi.mocked(api.storeSetting).mockRejectedValueOnce(new Error('failed'))

      await expect(store.set('test.setting', 'newvalue')).rejects.toThrow(
        'failed'
      )

      expect(trackSettingChanged).not.toHaveBeenCalled()
    })

    it('restores the previous value when persistence fails', async () => {
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default'
      })
      vi.mocked(api.storeSetting).mockRejectedValueOnce(new Error('offline'))

      await expect(store.set('test.setting', 'newvalue')).rejects.toThrow(
        'offline'
      )

      expect(store.get('test.setting')).toBe('default')
    })

    it('does not roll back a newer value when an older write fails', async () => {
      let rejectFirstWrite = (_error: Error): void => {}
      const firstWrite = new Promise<Response>((_resolve, reject) => {
        rejectFirstWrite = reject
      })
      vi.mocked(api.storeSetting)
        .mockReturnValueOnce(firstWrite)
        .mockResolvedValueOnce(new Response())
      store.addSetting({
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default'
      })

      const staleSet = store.set('test.setting', 'first')
      await vi.waitFor(() => {
        expect(api.storeSetting).toHaveBeenCalledTimes(1)
      })
      await store.set('test.setting', 'second')
      rejectFirstWrite(new Error('offline'))

      await expect(staleSet).rejects.toThrow('offline')
      expect(store.get('test.setting')).toBe('second')
    })

    describe('object mutation prevention', () => {
      beforeEach(() => {
        const setting: SettingParams = {
          id: 'test.setting',
          name: 'Test setting',
          type: 'hidden',
          defaultValue: {}
        }
        store.addSetting(setting)
      })

      it('should prevent mutations of objects after set', async () => {
        const originalObject = { foo: 'bar', nested: { value: 123 } }

        await store.set('test.setting', originalObject)

        // Attempt to mutate the original object
        originalObject.foo = 'changed'
        originalObject.nested.value = 456

        // Get the stored value
        const storedValue = store.get('test.setting')

        // Verify the stored value wasn't affected by the mutation
        expect(storedValue).toEqual({ foo: 'bar', nested: { value: 123 } })
      })

      it('should prevent mutations of retrieved objects', async () => {
        const initialValue = { foo: 'bar', nested: { value: 123 } }

        // Set initial value
        await store.set('test.setting', initialValue)

        // Get the value and try to mutate it
        const retrievedValue = store.get('test.setting')
        retrievedValue.foo = 'changed'
        if (retrievedValue.nested) {
          retrievedValue.nested.value = 456
        }

        // Get the value again
        const newRetrievedValue = store.get('test.setting')

        // Verify the stored value wasn't affected by the mutation
        expect(newRetrievedValue).toEqual({
          foo: 'bar',
          nested: { value: 123 }
        })
      })

      it('should prevent mutations of arrays after set', async () => {
        const originalArray = [1, 2, { value: 3 }]

        await store.set('test.setting', originalArray)

        // Attempt to mutate the original array
        originalArray.push(4)
        if (typeof originalArray[2] === 'object') {
          originalArray[2].value = 999
        }

        // Get the stored value
        const storedValue = store.get('test.setting')

        // Verify the stored value wasn't affected by the mutation
        expect(storedValue).toEqual([1, 2, { value: 3 }])
      })

      it('should prevent mutations of retrieved arrays', async () => {
        const initialArray = [1, 2, { value: 3 }]

        // Set initial value
        await store.set('test.setting', initialArray)

        // Get the value and try to mutate it
        const retrievedArray = store.get('test.setting')
        retrievedArray.push(4)
        if (typeof retrievedArray[2] === 'object') {
          retrievedArray[2].value = 999
        }

        // Get the value again
        const newRetrievedValue = store.get('test.setting')

        // Verify the stored value wasn't affected by the mutation
        expect(newRetrievedValue).toEqual([1, 2, { value: 3 }])
      })
    })
  })

  describe('setMany', () => {
    it('should set multiple values and make a single API call', async () => {
      const onChange1 = vi.fn()
      const onChange2 = vi.fn()
      store.addSetting({
        id: 'Comfy.Release.Version',
        name: 'Release Version',
        type: 'hidden',
        defaultValue: '',
        onChange: onChange1
      })
      store.addSetting({
        id: 'Comfy.Release.Status',
        name: 'Release Status',
        type: 'hidden',
        defaultValue: 'skipped',
        onChange: onChange2
      })
      vi.clearAllMocks()

      await store.setMany({
        'Comfy.Release.Version': '1.0.0',
        'Comfy.Release.Status': 'changelog seen'
      })

      expect(store.get('Comfy.Release.Version')).toBe('1.0.0')
      expect(store.get('Comfy.Release.Status')).toBe('changelog seen')
      expect(onChange1).toHaveBeenCalledWith('1.0.0', '')
      expect(onChange2).toHaveBeenCalledWith('changelog seen', 'skipped')
      expect(api.storeSettings).toHaveBeenCalledTimes(1)
      expect(api.storeSettings).toHaveBeenCalledWith({
        'Comfy.Release.Version': '1.0.0',
        'Comfy.Release.Status': 'changelog seen'
      })
      expect(api.storeSetting).not.toHaveBeenCalled()
    })

    it('tracks only the settings in a batch that opt in', async () => {
      store.addSetting({
        id: 'Comfy.ColorPalette',
        name: 'The active color palette id',
        type: 'hidden',
        defaultValue: 'dark',
        telemetry: { trackChanges: true, includeValues: true }
      })
      store.addSetting({
        id: 'Comfy.Release.Version',
        name: 'Release Version',
        type: 'hidden',
        defaultValue: ''
      })

      await store.setMany({
        'Comfy.ColorPalette': 'light',
        'Comfy.Release.Version': '1.0.0'
      })

      expect(trackSettingChanged).toHaveBeenCalledTimes(1)
      expect(trackSettingChanged).toHaveBeenCalledWith({
        setting_id: 'Comfy.ColorPalette',
        previous_value: 'dark',
        new_value: 'light'
      })
    })

    it('should skip unchanged values', async () => {
      store.addSetting({
        id: 'Comfy.Release.Version',
        name: 'Release Version',
        type: 'hidden',
        defaultValue: ''
      })
      store.addSetting({
        id: 'Comfy.Release.Status',
        name: 'Release Status',
        type: 'hidden',
        defaultValue: 'skipped'
      })
      await store.set('Comfy.Release.Version', 'existing')
      vi.clearAllMocks()

      await store.setMany({
        'Comfy.Release.Version': 'existing',
        'Comfy.Release.Status': 'changelog seen'
      })

      expect(api.storeSettings).toHaveBeenCalledWith({
        'Comfy.Release.Status': 'changelog seen'
      })
    })

    it('should not call API when all values are unchanged', async () => {
      store.addSetting({
        id: 'Comfy.Release.Version',
        name: 'Release Version',
        type: 'hidden',
        defaultValue: ''
      })
      await store.set('Comfy.Release.Version', 'existing')
      vi.clearAllMocks()

      await store.setMany({ 'Comfy.Release.Version': 'existing' })

      expect(api.storeSettings).not.toHaveBeenCalled()
      expect(trackSettingChanged).not.toHaveBeenCalled()
    })
  })
})

describe('getSettingInfo', () => {
  const baseSetting: SettingParams = {
    id: 'test.setting',
    name: 'test.setting',
    type: 'text',
    defaultValue: 'default'
  }

  it('should handle settings with explicit category array', () => {
    const setting: SettingParams = {
      ...baseSetting,
      id: 'test.setting',
      category: ['Main', 'Sub', 'Detail']
    }

    const result = getSettingInfo(setting)

    expect(result).toEqual({
      category: 'Main',
      subCategory: 'Sub'
    })
  })

  it('should handle settings with id-based categorization', () => {
    const setting: SettingParams = {
      ...baseSetting,
      id: 'main.sub.setting.name'
    }

    const result = getSettingInfo(setting)

    expect(result).toEqual({
      category: 'main',
      subCategory: 'sub'
    })
  })

  it('should use "Other" as default subCategory when missing', () => {
    const setting: SettingParams = {
      ...baseSetting,
      id: 'single.setting',
      category: ['single']
    }

    const result = getSettingInfo(setting)

    expect(result).toEqual({
      category: 'single',
      subCategory: 'Other'
    })
  })

  it('should use "Other" as default category when missing', () => {
    const setting: SettingParams = {
      ...baseSetting,
      id: 'single.setting',
      category: []
    }

    const result = getSettingInfo(setting)

    expect(result).toEqual({
      category: 'Other',
      subCategory: 'Other'
    })
  })
})
