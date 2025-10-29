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
          @click="handleOpenSettings"
        />
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
import { useDialogService } from '@/services/dialogService'

const { t } = useI18n()
const toast = useToast()
const dialogService = useDialogService()
const isDismissed = useVueNodesMigrationDismissed()

const handleOpenSettings = () => {
  dialogService.showSettingsDialog()
  toast.removeGroup('vue-nodes-migration')
  isDismissed.value = true
}

const handleClose = () => {
  isDismissed.value = true
}
</script>
