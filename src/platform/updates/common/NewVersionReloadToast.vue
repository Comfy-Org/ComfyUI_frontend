<template>
  <Toast :group="NEW_VERSION_TOAST_GROUP" position="bottom-right">
    <template #message="slotProps">
      <div class="flex flex-auto flex-col items-start gap-2">
        <div class="font-medium">
          {{ slotProps.message.summary }}
        </div>
        <div v-if="slotProps.message.detail" class="text-sm opacity-80">
          {{ slotProps.message.detail }}
        </div>
        <div class="flex gap-2 self-end">
          <Button
            severity="secondary"
            size="sm"
            @click="onDismiss(slotProps.message)"
          >
            {{ t('newVersionReload.dismiss') }}
          </Button>
          <Button size="sm" @click="onReload(slotProps.message)">
            {{ t('newVersionReload.reload') }}
          </Button>
        </div>
      </div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import { useToast } from 'primevue'
import type { ToastMessageOptions } from 'primevue/toast'
import Toast from 'primevue/toast'
import { onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'

import {
  NEW_VERSION_TOAST_GROUP,
  useNewVersionReloadPrompt
} from './useNewVersionReloadPrompt'

const { t } = useI18n()
const toast = useToast()
const toastStore = useToastStore()
const router = useRouter()

const removeToast = () => toast.removeGroup(NEW_VERSION_TOAST_GROUP)

const { accept, dismiss } = useNewVersionReloadPrompt({
  router,
  showPrompt: () => {
    // Route through the toast store so the message survives even if this
    // component mounts after the drift was detected.
    toastStore.add({
      group: NEW_VERSION_TOAST_GROUP,
      severity: 'info',
      summary: t('newVersionReload.title'),
      detail: t('newVersionReload.detail'),
      // No `life`: the prompt stays until the user reloads or dismisses it, so a
      // soft update notice never auto-dismisses out from under them.
      closable: false
    })
  },
  hidePrompt: removeToast
})

const onReload = (_message: ToastMessageOptions) => {
  accept()
}

const onDismiss = (_message: ToastMessageOptions) => {
  dismiss()
  removeToast()
}

onUnmounted(removeToast)
</script>
