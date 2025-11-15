<template>
  <Toast
    group="vue-nodes-migration"
    position="bottom-center"
    class="w-auto"
    @close="handleClose"
  >
    <template #message>
      <div class="flex flex-auto items-center justify-between gap-4">
        <span class="whitespace-nowrap">{{
          t('vueNodesMigration.message')
        }}</span>
        <Button
          class="whitespace-nowrap"
          size="small"
          :label="t('vueNodesMigration.button')"
          text
          @click="switchBack"
        />
      </div>
    </template>
  </Toast>
  <Toast
    group="vue-nodes-check-main-menu"
    position="bottom-center"
    class="w-auto"
  >
    <template #message>
      <div class="flex flex-auto items-center justify-between gap-4">
        <span class="whitespace-nowrap">{{
          t('vueNodesMigrationMainMenu.message')
        }}</span>
      </div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import { useToast } from 'primevue'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import { useI18n } from 'vue-i18n'

import { useVueNodesMigrationDismissed } from '@/composables/useVueNodesMigrationDismissed'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'

const { t } = useI18n()
const toast = useToast()
const isDismissed = useVueNodesMigrationDismissed()

const switchBack = async () => {
  await disableVueNodes()
  toast.removeGroup('vue-nodes-migration')
  isDismissed.value = true
  showMainMenuToast()
}

const handleClose = () => {
  isDismissed.value = true
  showMainMenuToast()
}

const disableVueNodes = async () => {
  await useSettingStore().set('Comfy.VueNodes.Enabled', false)
  useTelemetry()?.trackUiButtonClicked({
    button_id: `vue_nodes_migration_toast_switch_back_clicked`
  })
}

const showMainMenuToast = () => {
  useToastStore().add({
    group: 'vue-nodes-check-main-menu',
    severity: 'info',
    life: 5000
  })
}
</script>
