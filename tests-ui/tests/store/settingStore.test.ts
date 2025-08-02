import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { getSettingInfo, useSettingStore } from '@/stores/settingStore'
import type { SettingParams } from '@/types/settingTypes'

// Mock the api
vi.mock('@/scripts/api', () => ({
  api: {
    getSettings: vi.fn(),
    storeSetting: vi.fn()
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
    setActivePinia(createPinia())
    store = useSettingStore()
    vi.clearAllMocks()
  })

  it('should initialize with empty settings', () => {
    expect(store.settingValues).toEqual({})
    expect(store.settingsById).toEqual({})
  })

  describe('loadSettingValues', () => {
    it('should load settings from API', async () => {
      const mockSettings = { 'test.setting': 'value' }
      vi.mocked(api.getSettings).mockResolvedValue(mockSettings as any)

      await store.loadSettingValues()

      expect(store.settingValues).toEqual(mockSettings)
      expect(api.getSettings).toHaveBeenCalled()
    })

    it('should throw error if settings are loaded after registration', async () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default'
      }
      store.addSetting(setting)

      await expect(store.loadSettingValues()).rejects.toThrow(
        'Setting values must be loaded before any setting is registered.'
      )
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

    it('should throw error for duplicate setting ID', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default'
      }

      store.addSetting(setting)
      expect(() => store.addSetting(setting)).toThrow(
        'Setting test.setting must have a unique ID.'
      )
    })

    it('should migrate deprecated values', () => {
      const setting: SettingParams = {
        id: 'test.setting',
        name: 'test.setting',
        type: 'text',
        defaultValue: 'default',
        migrateDeprecatedValue: (value: string) => value.toUpperCase()
      }

      store.settingValues['test.setting'] = 'oldvalue'
      store.addSetting(setting)

      expect(store.settingValues['test.setting']).toBe('OLDVALUE')
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

      // Set the same value again, it should not trigger onChange
      await store.set('test.setting', 'newvalue')
      expect(onChangeMock).toHaveBeenCalledTimes(2)
      expect(dispatchChangeMock).toHaveBeenCalledTimes(2)

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
