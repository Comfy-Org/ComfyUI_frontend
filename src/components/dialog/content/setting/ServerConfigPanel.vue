<template>
  <Message v-if="modifiedConfigs.length > 0" severity="info" pt:text="w-full">
    <p>
      {{ $t('serverConfig.modifiedConfigs') }}
    </p>
    <ul>
      <li v-for="config in modifiedConfigs" :key="config.id">
        {{ config.name }}: {{ config.initialValue }} → {{ config.value }}
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
      <FormItem
        :item="item"
        v-model:formValue="item.value"
        :id="item.id"
        :labelClass="{
          'text-highlight': item.initialValue !== item.value
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import Divider from 'primevue/divider'
import FormItem from '@/components/common/FormItem.vue'
import { formatCamelCase } from '@/utils/formatUtil'
import { useServerConfigStore } from '@/stores/serverConfigStore'
import { storeToRefs } from 'pinia'
import { electronAPI } from '@/utils/envUtil'
import { useSettingStore } from '@/stores/settingStore'
import { watch } from 'vue'

const settingStore = useSettingStore()
const serverConfigStore = useServerConfigStore()
const {
  serverConfigsByCategory,
  serverConfigValues,
  launchArgs,
  modifiedConfigs
} = storeToRefs(serverConfigStore)

const revertChanges = () => {
  for (const config of modifiedConfigs.value) {
    config.value = config.initialValue
  }
}

const restartApp = () => {
  electronAPI().restartApp()
}

watch(launchArgs, (newVal) => {
  settingStore.set('Comfy.Server.LaunchArgs', newVal)
})

watch(serverConfigValues, (newVal) => {
  settingStore.set('Comfy.Server.ServerConfigValues', newVal)
})
</script>
