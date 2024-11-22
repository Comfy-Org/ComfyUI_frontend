import { setActivePinia, createPinia } from 'pinia'
import { useServerConfigStore } from '@/stores/serverConfigStore'
import { ServerConfig } from '@/constants/serverConfig'
import type { FormItem } from '@/types/settingTypes'

const dummyFormItem: FormItem = {
  name: '',
  type: 'text'
}

describe('useServerConfigStore', () => {
  let store: ReturnType<typeof useServerConfigStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useServerConfigStore()
  })

  it('should initialize with empty configs', () => {
    expect(store.serverConfigs).toHaveLength(0)
    expect(Object.keys(store.serverConfigById)).toHaveLength(0)
    expect(Object.keys(store.serverConfigsByCategory)).toHaveLength(0)
    expect(Object.keys(store.serverConfigValues)).toHaveLength(0)
    expect(Object.keys(store.launchArgs)).toHaveLength(0)
  })

  it('should load server configs with default values', () => {
    const configs: ServerConfig<any>[] = [
      {
        ...dummyFormItem,
        id: 'test.config1',
        defaultValue: 'default1',
        category: ['Test']
      },
      {
        ...dummyFormItem,
        id: 'test.config2',
        defaultValue: 'default2'
      }
    ]

    store.loadServerConfig(configs, {})

    expect(store.serverConfigs).toHaveLength(2)
    expect(store.serverConfigById['test.config1'].value).toBe('default1')
    expect(store.serverConfigById['test.config2'].value).toBe('default2')
  })

  it('should load server configs with provided values', () => {
    const configs: ServerConfig<any>[] = [
      {
        ...dummyFormItem,
        id: 'test.config1',
        defaultValue: 'default1',
        category: ['Test']
      }
    ]

    store.loadServerConfig(configs, {
      'test.config1': 'custom1'
    })

    expect(store.serverConfigs).toHaveLength(1)
    expect(store.serverConfigById['test.config1'].value).toBe('custom1')
  })

  it('should organize configs by category', () => {
    const configs: ServerConfig<any>[] = [
      {
        ...dummyFormItem,
        id: 'test.config1',
        defaultValue: 'default1',
        category: ['Test']
      },
      {
        ...dummyFormItem,
        id: 'test.config2',
        defaultValue: 'default2',
        category: ['Other']
      },
      {
        ...dummyFormItem,
        id: 'test.config3',
        defaultValue: 'default3'
      }
    ]

    store.loadServerConfig(configs, {})

    expect(Object.keys(store.serverConfigsByCategory)).toHaveLength(3)
    expect(store.serverConfigsByCategory['Test']).toHaveLength(1)
    expect(store.serverConfigsByCategory['Other']).toHaveLength(1)
    expect(store.serverConfigsByCategory['General']).toHaveLength(1)
  })

  it('should generate server config values excluding defaults', () => {
    const configs: ServerConfig<any>[] = [
      {
        ...dummyFormItem,
        id: 'test.config1',
        defaultValue: 'default1'
      },
      {
        ...dummyFormItem,
        id: 'test.config2',
        defaultValue: 'default2'
      }
    ]

    store.loadServerConfig(configs, {
      'test.config1': 'custom1',
      'test.config2': 'default2'
    })

    expect(Object.keys(store.serverConfigValues)).toHaveLength(2)
    expect(store.serverConfigValues['test.config1']).toBe('custom1')
    expect(store.serverConfigValues['test.config2']).toBeUndefined()
  })

  it('should generate launch arguments with custom getValue function', () => {
    const configs: ServerConfig<any>[] = [
      {
        ...dummyFormItem,
        id: 'test.config1',
        defaultValue: 'default1',
        getValue: (value: string) => ({ customArg: value })
      },
      {
        ...dummyFormItem,
        id: 'test.config2',
        defaultValue: 'default2'
      }
    ]

    store.loadServerConfig(configs, {
      'test.config1': 'custom1',
      'test.config2': 'custom2'
    })

    expect(Object.keys(store.launchArgs)).toHaveLength(2)
    expect(store.launchArgs['customArg']).toBe('custom1')
    expect(store.launchArgs['test.config2']).toBe('custom2')
  })

  it('should not include default values in launch arguments', () => {
    const configs: ServerConfig<any>[] = [
      {
        ...dummyFormItem,
        id: 'test.config1',
        defaultValue: 'default1'
      },
      {
        ...dummyFormItem,
        id: 'test.config2',
        defaultValue: 'default2'
      }
    ]

    store.loadServerConfig(configs, {
      'test.config1': 'custom1',
      'test.config2': 'default2'
    })

    expect(Object.keys(store.launchArgs)).toHaveLength(1)
    expect(store.launchArgs['test.config1']).toBe('custom1')
    expect(store.launchArgs['test.config2']).toBeUndefined()
  })

  it('should not include nullish values in launch arguments', () => {
    const configs: ServerConfig<any>[] = [
      { ...dummyFormItem, id: 'test.config1', defaultValue: 'default1' },
      { ...dummyFormItem, id: 'test.config2', defaultValue: 'default2' },
      { ...dummyFormItem, id: 'test.config3', defaultValue: 'default3' }
    ]

    store.loadServerConfig(configs, {
      'test.config1': undefined,
      'test.config2': null,
      'test.config3': ''
    })

    expect(Object.keys(store.launchArgs)).toHaveLength(0)
    expect(Object.keys(store.serverConfigValues)).toEqual([
      'test.config1',
      'test.config2',
      'test.config3'
    ])
  })
})
