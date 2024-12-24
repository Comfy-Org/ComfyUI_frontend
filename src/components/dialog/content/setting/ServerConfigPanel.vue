<template>
  <PanelTemplate value="Server-Config" class="server-config-panel">
    <template #header>
      <div class="flex flex-col gap-2">
        <Message
          v-if="modifiedConfigs.length > 0"
          severity="info"
          pt:text="w-full"
        >
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
        <Message v-if="commandLineArgs" severity="secondary" pt:text="w-full">
          <template #icon>
            <i-lucide:terminal class="text-xl font-bold" />
          </template>
          <div class="flex items-center justify-between">
            <p>{{ commandLineArgs }}</p>
            <Button
              icon="pi pi-clipboard"
              @click="copyCommandLineArgs"
              severity="secondary"
              text
            />
          </div>
        </Message>
      </div>
    </template>
    <div
      v-for="([label, items], i) in Object.entries(serverConfigsByCategory)"
      :key="label"
    >
      <Divider v-if="i > 0" />
      <h3>{{ $t(`serverConfigCategories.${label}`, label) }}</h3>
      <div v-for="item in items" :key="item.name" class="mb-4">
        <FormItem
          :item="translateItem(item)"
          v-model:formValue="item.value"
          :id="item.id"
          :labelClass="{
            'text-highlight': item.initialValue !== item.value
          }"
        />
      </div>
    </div>
  </PanelTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import Divider from 'primevue/divider'
import FormItem from '@/components/common/FormItem.vue'
import PanelTemplate from './PanelTemplate.vue'
import { useServerConfigStore } from '@/stores/serverConfigStore'
import { storeToRefs } from 'pinia'
import { electronAPI } from '@/utils/envUtil'
import { useSettingStore } from '@/stores/settingStore'
import { watch } from 'vue'
import { useCopyToClipboard } from '@/hooks/clipboardHooks'
import type { FormItem as FormItemType } from '@/types/settingTypes'
import type { ServerConfig } from '@/constants/serverConfig'
import { useI18n } from 'vue-i18n'

const settingStore = useSettingStore()
const serverConfigStore = useServerConfigStore()
const {
  serverConfigsByCategory,
  serverConfigValues,
  launchArgs,
  commandLineArgs,
  modifiedConfigs
} = storeToRefs(serverConfigStore)

const revertChanges = () => {
  serverConfigStore.revertChanges()
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

const { copyToClipboard } = useCopyToClipboard()
const copyCommandLineArgs = async () => {
  await copyToClipboard(commandLineArgs.value)
}

const { t } = useI18n()
const translateItem = (item: ServerConfig<any>): FormItemType => {
  return {
    ...item,
    name: t(`serverConfigItems.${item.id}.name`, item.name),
    tooltip: item.tooltip
      ? t(`serverConfigItems.${item.id}.tooltip`, item.tooltip)
      : undefined
  }
}
</script>
