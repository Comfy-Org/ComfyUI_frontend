import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import type { Keybinding } from '@/platform/keybindings/types'
import { useTelemetry } from '@/platform/telemetry'
import type { NodeBadgeMode } from '@/types/nodeSource'
import type { LinkReleaseTriggerAction } from '@/types/searchBoxTypes'

import {
  getSettingInfo,
  useSettingStore
} from '@/platform/settings/settingStore'
import type { SettingParams, Settings } from '@/platform/settings/types'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

vi.mock(import('@/platform/telemetry'))

// Mock the api
vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    getSettings: vi.fn(),
    storeSetting: vi.fn(),
    storeSettings: vi.fn()
  }
}))

vi.mock(import('@/scripts/app'))

describe('useSettingStore', () => {
  let store: ReturnType<typeof useSettingStore>

  beforeEach(() => {
    store = useSettingStore()
  })

  it('preserves enum types when reading settings', () => {
    expectTypeOf<
      Settings['Comfy.NodeBadge.NodeIdBadgeMode']
    >().toEqualTypeOf<NodeBadgeMode>()
    expectTypeOf<
      Settings['Comfy.LinkRelease.Action']
    >().toEqualTypeOf<LinkReleaseTriggerAction>()
  })

  it('should initialize with empty settings', () => {
    expect(store.settingValues).toEqual({})
    expect(store.settingsById).toEqual({})
  })

  describe('load', () => {
    it('should load settings from API', async () => {
      const mockSettings = { 'Comfy.Locale': 'value' }
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
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
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
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default'
      }

      store.addSetting(setting)

      expect(store.settingsById['Comfy.Locale']).toEqual(setting)
    })

    it('should warn and skip for duplicate setting ID', () => {
      const setting: SettingParams = {
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default'
      }
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      store.addSetting(setting)
      store.addSetting(setting)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Setting already registered: Comfy.Locale'
      )
      consoleWarnSpy.mockRestore()
    })

    it('should migrate deprecated values', () => {
      const setting: SettingParams = {
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default',
        migrateDeprecatedValue: (val: unknown) => (val as string).toUpperCase()
      }

      store.settingValues['Comfy.Locale'] = 'oldvalue'
      store.addSetting(setting)

      expect(store.settingValues['Comfy.Locale']).toBe('OLDVALUE')
    })
  })

  describe('getDefaultValue', () => {
    beforeEach(() => {
      // Set up installed version for most tests
      store.settingValues['Comfy.InstalledVersion'] = '1.30.0'
    })

    it('should return regular default value when no defaultsByInstallVersion', () => {
      const setting: SettingParams = {
        id: 'Comfy.Locale',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default'
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('Comfy.Locale')
      expect(result).toBe('regular-default')
    })

    it('should return versioned default when user version matches', () => {
      const setting: SettingParams = {
        id: 'Comfy.Locale',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('Comfy.Locale')
      // installedVersion is 1.30.0, so should get 1.21.3 default
      expect(result).toBe('version-1.21.3-default')
    })

    it('should return latest versioned default when user version is higher', () => {
      store.settingValues['Comfy.InstalledVersion'] = '1.50.0'

      const setting: SettingParams = {
        id: 'Comfy.Locale',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('Comfy.Locale')
      // installedVersion is 1.50.0, so should get 1.40.3 default
      expect(result).toBe('version-1.40.3-default')
    })

    it('should return regular default when user version is lower than all versioned defaults', () => {
      store.settingValues['Comfy.InstalledVersion'] = '1.10.0'

      const setting: SettingParams = {
        id: 'Comfy.Locale',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('Comfy.Locale')
      // installedVersion is 1.10.0, lower than all versioned defaults
      expect(result).toBe('regular-default')
    })

    it('should return regular default when no installed version (existing users)', () => {
      // Clear installed version to simulate existing user
      delete store.settingValues['Comfy.InstalledVersion']

      const setting: SettingParams = {
        id: 'Comfy.Locale',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('Comfy.Locale')
      // No installed version, should use backward compatibility
      expect(result).toBe('regular-default')
    })

    it.for([
      {
        setting: {
          id: 'Comfy.EnableTooltips',
          name: 'Tooltips',
          type: 'boolean',
          defaultValue: true,
          defaultsByInstallVersion: { '1.21.3': false }
        } satisfies SettingParams<boolean>,
        expected: false
      },
      {
        setting: {
          id: 'Comfy.Graph.ZoomSpeed',
          name: 'Zoom speed',
          type: 'number',
          defaultValue: 1,
          defaultsByInstallVersion: { '1.21.3': 0 }
        } satisfies SettingParams<number>,
        expected: 0
      },
      {
        setting: {
          id: 'Comfy.Locale',
          name: 'Locale',
          type: 'text',
          defaultValue: 'en',
          defaultsByInstallVersion: { '1.21.3': '' }
        } satisfies SettingParams<string>,
        expected: ''
      }
    ])(
      'should return a falsy versioned default ($expected)',
      ({ setting, expected }) => {
        store.addSetting(setting)

        expect(store.getDefaultValue(setting.id)).toBe(expected)
      }
    )

    it('should handle function-based versioned defaults', () => {
      const setting: SettingParams = {
        id: 'Comfy.Locale',
        name: 'Test Setting',
        type: 'text',
        defaultValue: 'regular-default',
        defaultsByInstallVersion: {
          '1.21.3': () => 'dynamic-version-1.21.3-default',
          '1.40.3': () => 'dynamic-version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('Comfy.Locale')
      // installedVersion is 1.30.0, so should get 1.21.3 default (executed)
      expect(result).toBe('dynamic-version-1.21.3-default')
    })

    it('should handle function-based regular defaults with versioned defaults', () => {
      store.settingValues['Comfy.InstalledVersion'] = '1.10.0'

      const setting: SettingParams = {
        id: 'Comfy.Locale',
        name: 'Test Setting',
        type: 'text',
        defaultValue: () => 'dynamic-regular-default',
        defaultsByInstallVersion: {
          '1.21.3': 'version-1.21.3-default',
          '1.40.3': 'version-1.40.3-default'
        }
      }
      store.addSetting(setting)

      const result = store.getDefaultValue('Comfy.Locale')
      // installedVersion is 1.10.0, should fallback to function-based regular default
      expect(result).toBe('dynamic-regular-default')
    })

    it('should handle complex version comparison correctly', () => {
      const setting: SettingParams = {
        id: 'Comfy.Locale',
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
      expect(store.getDefaultValue('Comfy.Locale')).toBe(
        'version-1.21.3-default'
      )

      // Test with 1.21.15 - should get 1.21.10 default
      store.settingValues['Comfy.InstalledVersion'] = '1.21.15'
      expect(store.getDefaultValue('Comfy.Locale')).toBe(
        'version-1.21.10-default'
      )

      // Test with 1.21.3 exactly - should get 1.21.3 default
      store.settingValues['Comfy.InstalledVersion'] = '1.21.3'
      expect(store.getDefaultValue('Comfy.Locale')).toBe(
        'version-1.21.3-default'
      )
    })

    it('should work with get() method using versioned defaults', () => {
      const setting: SettingParams = {
        id: 'Comfy.Locale',
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
      const result = store.get('Comfy.Locale')
      expect(result).toBe('version-1.21.3-default')
    })

    it('should handle mixed function and static versioned defaults', () => {
      const setting: SettingParams = {
        id: 'Comfy.Locale',
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
      expect(store.getDefaultValue('Comfy.Locale')).toBe(
        'dynamic-1.21.3-default'
      )

      // Test with 1.50.0 - should get static 1.40.3 default
      store.settingValues['Comfy.InstalledVersion'] = '1.50.0'
      expect(store.getDefaultValue('Comfy.Locale')).toBe(
        'static-1.40.3-default'
      )
    })

    it('should handle version sorting correctly', () => {
      const setting: SettingParams = {
        id: 'Comfy.Locale',
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
      expect(store.getDefaultValue('Comfy.Locale')).toBe(
        'version-1.35.0-default'
      )
    })
  })

  describe('get and set', () => {
    it('should get default value when setting not exists', () => {
      const setting: SettingParams = {
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default'
      }
      store.addSetting(setting)

      expect(store.get('Comfy.Locale')).toBe('default')
    })

    it('should set value and trigger onChange', async () => {
      const onChangeMock = vi.fn()
      const dispatchChangeMock = vi.mocked(app.ui.settings.dispatchChange)
      const setting: SettingParams = {
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default',
        onChange: onChangeMock
      }
      store.addSetting(setting)
      // Adding the new setting should trigger onChange
      expect(onChangeMock).toHaveBeenCalledTimes(1)
      expect(dispatchChangeMock).toHaveBeenCalledTimes(1)

      await store.set('Comfy.Locale', 'newvalue')

      expect(store.get('Comfy.Locale')).toBe('newvalue')
      expect(onChangeMock).toHaveBeenCalledWith('newvalue', 'default')
      expect(onChangeMock).toHaveBeenCalledTimes(2)
      expect(dispatchChangeMock).toHaveBeenCalledTimes(2)
      expect(api.storeSetting).toHaveBeenCalledWith('Comfy.Locale', 'newvalue')

      // Set a different value, it should trigger onChange
      await store.set('Comfy.Locale', 'differentvalue')
      expect(onChangeMock).toHaveBeenCalledWith('differentvalue', 'newvalue')
      expect(onChangeMock).toHaveBeenCalledTimes(3)
      expect(dispatchChangeMock).toHaveBeenCalledTimes(3)
      expect(api.storeSetting).toHaveBeenCalledWith(
        'Comfy.Locale',
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
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default',
        onChange: async (_value, old) => {
          if (!old) return
          await Promise.resolve()
          order.push('onChange')
        }
      })

      await store.set('Comfy.Locale', 'newvalue')

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
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default',
        onChange
      })

      await expect(
        store.set('Comfy.Locale', 'newvalue')
      ).resolves.toBeUndefined()

      expect(api.storeSetting).toHaveBeenCalledWith('Comfy.Locale', 'newvalue')
      expect(store.get('Comfy.Locale')).toBe('newvalue')
    })

    it('does not persist a value a newer set() has superseded', async () => {
      let releaseFirst = () => {}
      const firstHandlerGate = new Promise<void>((resolve) => {
        releaseFirst = resolve
      })
      let isFirstChange = true
      store.addSetting({
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default',
        onChange: async (_value, old) => {
          if (!old || !isFirstChange) return
          isFirstChange = false
          await firstHandlerGate
        }
      })

      const stalled = store.set('Comfy.Locale', 'first')
      await store.set('Comfy.Locale', 'second')
      releaseFirst()
      await stalled

      expect(store.get('Comfy.Locale')).toBe('second')
      expect(api.storeSetting).toHaveBeenLastCalledWith(
        'Comfy.Locale',
        'second'
      )
    })

    it('exposes the new value to onChange handlers', async () => {
      const observed: unknown[] = []
      store.addSetting({
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default',
        onChange: () => {
          observed.push(store.get('Comfy.Locale'))
        }
      })

      await store.set('Comfy.Locale', 'newvalue')

      expect(observed).toEqual(['default', 'newvalue'])
    })

    it('tracks visible settings with values by default', async () => {
      store.addSetting({
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default'
      })

      await store.set('Comfy.Locale', 'newvalue')

      expect(useTelemetry()?.trackSettingChanged).toHaveBeenCalledWith({
        setting_id: 'Comfy.Locale',
        previous_value: 'default',
        new_value: 'newvalue'
      })
    })

    it('does not track hidden settings by default', async () => {
      store.addSetting({
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'hidden',
        defaultValue: 'default'
      })

      await store.set('Comfy.Locale', 'newvalue')

      expect(useTelemetry()?.trackSettingChanged).not.toHaveBeenCalled()
    })

    it('does not track visible settings that opt out', async () => {
      store.addSetting({
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default',
        telemetry: { trackChanges: false }
      })

      await store.set('Comfy.Locale', 'newvalue')

      expect(useTelemetry()?.trackSettingChanged).not.toHaveBeenCalled()
    })

    it('tracks visible settings without values when values opt out', async () => {
      store.addSetting({
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default',
        telemetry: { includeValues: false }
      })

      await store.set('Comfy.Locale', 'newvalue')

      expect(useTelemetry()?.trackSettingChanged).toHaveBeenCalledWith({
        setting_id: 'Comfy.Locale'
      })
    })

    it('tracks hidden settings that opt in, without shipping values by default', async () => {
      store.addSetting({
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'hidden',
        defaultValue: 'default',
        telemetry: { trackChanges: true }
      })

      await store.set('Comfy.Locale', 'newvalue')
      expect(useTelemetry()?.trackSettingChanged).toHaveBeenCalledWith({
        setting_id: 'Comfy.Locale'
      })

      // Setting the same value again is a no-op and should not re-emit
      await store.set('Comfy.Locale', 'newvalue')
      expect(useTelemetry()?.trackSettingChanged).toHaveBeenCalledTimes(1)
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

      expect(useTelemetry()?.trackSettingChanged).toHaveBeenCalledWith({
        setting_id: 'Comfy.ColorPalette',
        previous_value: 'dark',
        new_value: 'light'
      })
    })

    it('does not track telemetry when persistence fails', async () => {
      store.addSetting({
        id: 'Comfy.Locale',
        name: 'Comfy.Locale',
        type: 'text',
        defaultValue: 'default',
        telemetry: { trackChanges: true }
      })
      vi.mocked(api.storeSetting).mockRejectedValueOnce(new Error('failed'))

      await expect(store.set('Comfy.Locale', 'newvalue')).rejects.toThrow(
        'failed'
      )

      expect(useTelemetry()?.trackSettingChanged).not.toHaveBeenCalled()
    })

    describe('object mutation prevention', () => {
      beforeEach(() => {
        const setting: SettingParams = {
          id: 'Comfy.NodeLibrary.BookmarksCustomization',
          name: 'Test setting',
          type: 'hidden',
          defaultValue: {}
        }
        store.addSetting(setting)
      })

      it('should prevent mutations of objects after set', async () => {
        const originalObject = {
          folder: { icon: 'bookmark', color: 'blue' }
        }

        await store.set(
          'Comfy.NodeLibrary.BookmarksCustomization',
          originalObject
        )

        originalObject.folder.icon = 'changed'
        originalObject.folder.color = 'red'

        const storedValue = store.get(
          'Comfy.NodeLibrary.BookmarksCustomization'
        )

        expect(storedValue).toEqual({
          folder: { icon: 'bookmark', color: 'blue' }
        })
      })

      it('should prevent mutations of retrieved objects', async () => {
        const initialValue = {
          folder: { icon: 'bookmark', color: 'blue' }
        }

        await store.set(
          'Comfy.NodeLibrary.BookmarksCustomization',
          initialValue
        )

        const retrievedValue = store.get(
          'Comfy.NodeLibrary.BookmarksCustomization'
        )
        retrievedValue.folder.icon = 'changed'
        retrievedValue.folder.color = 'red'

        const newRetrievedValue = store.get(
          'Comfy.NodeLibrary.BookmarksCustomization'
        )

        expect(newRetrievedValue).toEqual({
          folder: { icon: 'bookmark', color: 'blue' }
        })
      })

      it('should prevent mutations of arrays after set', async () => {
        const binding: Keybinding = {
          commandId: 'Comfy.Test',
          combo: { key: 'a' }
        }
        const originalArray: Keybinding[] = [binding]

        await store.set('Comfy.Keybinding.NewBindings', originalArray)

        originalArray.push({ commandId: 'Comfy.Other', combo: { key: 'b' } })
        binding.combo.key = 'changed'

        const storedValue = store.get('Comfy.Keybinding.NewBindings')

        expect(storedValue).toEqual([
          { commandId: 'Comfy.Test', combo: { key: 'a' } }
        ])
      })

      it('should prevent mutations of retrieved arrays', async () => {
        const initialArray: Keybinding[] = [
          { commandId: 'Comfy.Test', combo: { key: 'a' } }
        ]

        await store.set('Comfy.Keybinding.NewBindings', initialArray)

        const retrievedArray = store.get('Comfy.Keybinding.NewBindings')
        retrievedArray.push({
          commandId: 'Comfy.Other',
          combo: { key: 'b' }
        })
        retrievedArray[0].combo.key = 'changed'

        const newRetrievedValue = store.get('Comfy.Keybinding.NewBindings')

        expect(newRetrievedValue).toEqual([
          { commandId: 'Comfy.Test', combo: { key: 'a' } }
        ])
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

      expect(useTelemetry()?.trackSettingChanged).toHaveBeenCalledTimes(1)
      expect(useTelemetry()?.trackSettingChanged).toHaveBeenCalledWith({
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
      expect(useTelemetry()?.trackSettingChanged).not.toHaveBeenCalled()
    })
  })
})

describe('getSettingInfo', () => {
  const baseSetting: SettingParams = {
    id: 'Comfy.Locale',
    name: 'Comfy.Locale',
    type: 'text',
    defaultValue: 'default'
  }

  it('should handle settings with explicit category array', () => {
    const setting: SettingParams = {
      ...baseSetting,
      id: 'Comfy.Locale',
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
      id: 'Comfy.NodeLibrary.Bookmarks.V2'
    }

    const result = getSettingInfo(setting)

    expect(result).toEqual({
      category: 'Comfy',
      subCategory: 'NodeLibrary'
    })
  })

  it('should use "Other" as default subCategory when missing', () => {
    const setting: SettingParams = {
      ...baseSetting,
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
      category: []
    }

    const result = getSettingInfo(setting)

    expect(result).toEqual({
      category: 'Other',
      subCategory: 'Other'
    })
  })
})
