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
              outlined
              @click="revertChanges"
            />
            <Button
              :label="$t('serverConfig.restart')"
              outlined
              severity="danger"
              @click="restartApp"
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
              severity="secondary"
              text
              @click="copyCommandLineArgs"
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
          :id="item.id"
          v-model:formValue="item.value"
          :item="translateItem(item)"
          :label-class="{
            'text-highlight': item.initialValue !== item.value
          }"
        />
      </div>
    </div>
  </PanelTemplate>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FormItem from '@/components/common/FormItem.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import type { ServerConfig } from '@/constants/serverConfig'
import { useServerConfigStore } from '@/stores/serverConfigStore'
import { useSettingStore } from '@/stores/settingStore'
import type { FormItem as FormItemType } from '@/types/settingTypes'
import { electronAPI } from '@/utils/envUtil'

import PanelTemplate from './PanelTemplate.vue'

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

const restartApp = async () => {
  await electronAPI().restartApp()
}

watch(launchArgs, async (newVal) => {
  await settingStore.set('Comfy.Server.LaunchArgs', newVal)
})

watch(serverConfigValues, async (newVal) => {
  await settingStore.set('Comfy.Server.ServerConfigValues', newVal)
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
