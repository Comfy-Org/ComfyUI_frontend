import { ServerConfig } from '@/constants/serverConfig'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type ServerConfigWithValue<T> = ServerConfig<T> & {
  value: T
}

export const useServerConfigStore = defineStore('serverConfig', () => {
  const serverConfigById = ref<Record<string, ServerConfigWithValue<any>>>({})
  const serverConfigs = computed(() => {
    return Object.values(serverConfigById.value)
  })
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
      serverConfigById.value[config.id] = {
        ...config,
        value: values[config.id] ?? config.defaultValue
      }
    }
  }

  return {
    serverConfigById,
    serverConfigs,
    serverConfigsByCategory,
    serverConfigValues,
    launchArgs,
    loadServerConfig
  }
})
