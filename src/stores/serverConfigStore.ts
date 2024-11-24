import { ServerConfig } from '@/constants/serverConfig'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type ServerConfigWithValue<T> = ServerConfig<T> & {
  /**
   * Current value.
   */
  value: T
  /**
   * Initial value loaded from settings.
   */
  initialValue: T
}

export const useServerConfigStore = defineStore('serverConfig', () => {
  const serverConfigById = ref<Record<string, ServerConfigWithValue<any>>>({})
  const serverConfigs = computed(() => {
    return Object.values(serverConfigById.value)
  })
  const modifiedConfigs = computed<ServerConfigWithValue<any>[]>(() => {
    return serverConfigs.value.filter((config) => {
      return config.initialValue !== config.value
    })
  })
  const revertChanges = () => {
    for (const config of modifiedConfigs.value) {
      config.value = config.initialValue
    }
  }
  const serverConfigsByCategory = computed<
    Record<string, ServerConfigWithValue<any>[]>
  >(() => {
    return serverConfigs.value.reduce(
      (acc, config) => {
        const category = config.category?.[0] ?? 'General'
        acc[category] = acc[category] || []
        acc[category].push(config)
        return acc
      },
      {} as Record<string, ServerConfigWithValue<any>[]>
    )
  })
  const serverConfigValues = computed<Record<string, any>>(() => {
    return Object.fromEntries(
      serverConfigs.value.map((config) => {
        return [
          config.id,
          config.value === config.defaultValue || !config.value
            ? undefined
            : config.value
        ]
      })
    )
  })
  const launchArgs = computed<Record<string, string>>(() => {
    return Object.assign(
      {},
      ...serverConfigs.value.map((config) => {
        if (config.value === config.defaultValue || !config.value) {
          return {}
        }
        return config.getValue
          ? config.getValue(config.value)
          : { [config.id]: config.value }
      })
    )
  })

  function loadServerConfig(
    configs: ServerConfig<any>[],
    values: Record<string, any>
  ) {
    for (const config of configs) {
      const value = values[config.id] ?? config.defaultValue
      serverConfigById.value[config.id] = {
        ...config,
        value,
        initialValue: value
      }
    }
  }

  return {
    serverConfigById,
    serverConfigs,
    modifiedConfigs,
    serverConfigsByCategory,
    serverConfigValues,
    launchArgs,
    revertChanges,
    loadServerConfig
  }
})
