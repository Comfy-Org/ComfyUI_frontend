<template>
  <Message v-if="modifiedConfigs.length > 0" severity="info" pt:text="w-full">
    <p>
      {{ $t('serverConfig.modifiedConfigs') }}
    </p>
    <ul>
      <li v-for="config in modifiedConfigs" :key="config.key">
        {{ config.key }}: {{ config.initialValue }} → {{ config.value }}
      </li>
    </ul>
    <div class="flex justify-end gap-2">
      <Button
        :label="$t('serverConfig.revertChanges')"
        @click="revertChanges"
        outlined
      />
      <Button
        :label="$t('serverConfig.restart')"
        @click="restartApp"
        outlined
        severity="danger"
      />
    </div>
  </Message>
  <div
    v-for="([label, items], i) in Object.entries(serverConfigsByCategory)"
    :key="label"
  >
    <Divider v-if="i > 0" />
    <h3>{{ formatCamelCase(label) }}</h3>
    <div v-for="item in items" :key="item.name" class="flex items-center mb-4">
      <FormItem :item="item" v-model:formValue="item.value" :id="item.id" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import Divider from 'primevue/divider'
import FormItem from '@/components/common/FormItem.vue'
import { formatCamelCase } from '@/utils/formatUtil'
import { useSettingStore } from '@/stores/settingStore'
import { useServerConfigStore } from '@/stores/serverConfigStore'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { SERVER_CONFIG_ITEMS } from '@/constants/serverConfig'
import { electronAPI } from '@/utils/envUtil'

const settingStore = useSettingStore()
const serverConfigStore = useServerConfigStore()
const {
  serverConfigsByCategory,
  launchArgs,
  serverConfigValues,
  serverConfigById
} = storeToRefs(serverConfigStore)
const initialServerConfigValues = settingStore.get(
  'Comfy.Server.ServerConfigValues'
)

interface ModifiedConfig {
  key: string
  initialValue: string
  value: string
}

const modifiedConfigs = computed<ModifiedConfig[]>(() => {
  return Object.entries(serverConfigValues.value)
    .map(([key, value]) => {
      const serverConfig = serverConfigById.value[key]
      const initialValue =
        initialServerConfigValues[key] ?? serverConfig?.defaultValue
      return { key, initialValue, value: value || serverConfig?.defaultValue }
    })
    .filter((config) => {
      return config.initialValue !== config.value
    })
})

const revertChanges = () => {
  serverConfigStore.loadServerConfig(
    SERVER_CONFIG_ITEMS,
    initialServerConfigValues
  )
}

const restartApp = () => {
  electronAPI().restartApp()
}

onMounted(() => {
  serverConfigStore.loadServerConfig(
    SERVER_CONFIG_ITEMS,
    initialServerConfigValues
  )
})

onBeforeUnmount(() => {
  settingStore.set('Comfy.Server.ServerConfigValues', serverConfigValues.value)
  settingStore.set('Comfy.Server.LaunchArgs', launchArgs.value)
})
</script>
