<template>
  <Toast />
  <Toast group="billing-operation" position="top-right">
    <template #message="slotProps">
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <i class="pi pi-spin pi-spinner text-primary" />
          <span>{{ slotProps.message.summary }}</span>
        </div>
        <a
          v-if="billingOperationStore.hostedInvoiceUrl"
          :href="billingOperationStore.hostedInvoiceUrl"
          target="_blank"
          rel="noopener noreferrer"
          :class="
            cn(
              buttonVariants({ variant: 'primary', size: 'lg' }),
              'w-full no-underline'
            )
          "
        >
          {{ $t('billingOperation.continueToPayment') }}
          <i class="pi pi-external-link" />
        </a>
      </div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { nextTick, watch } from 'vue'

import { buttonVariants } from '@/components/ui/button/button.variants'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

const toast = useToast()
const toastStore = useToastStore()
const settingStore = useSettingStore()
const billingOperationStore = useBillingOperationStore()

watch(
  () => toastStore.messagesToAdd,
  (newMessages) => {
    if (newMessages.length === 0) {
      return
    }

    newMessages.forEach((message) => {
      toast.add(message)
    })
    toastStore.messagesToAdd = []
  },
  { deep: true, immediate: true }
)

watch(
  () => toastStore.messagesToRemove,
  (messagesToRemove) => {
    if (messagesToRemove.length === 0) {
      return
    }

    messagesToRemove.forEach((message) => {
      toast.remove(message)
    })
    toastStore.messagesToRemove = []
  },
  { deep: true }
)

watch(
  () => toastStore.removeAllRequested,
  (requested) => {
    if (requested) {
      toast.removeAllGroups()
      toastStore.removeAllRequested = false
    }
  }
)

function updateToastPosition() {
  const styleElement =
    document.getElementById('dynamic-toast-style') || createStyleElement()
  const rect = document
    .querySelector('.graph-canvas-container')
    ?.getBoundingClientRect()
  if (!rect) return

  styleElement.textContent = `
    .p-toast.p-component.p-toast-top-right {
      top: ${rect.top + 100}px !important;
      right: ${window.innerWidth - (rect.left + rect.width) + 20}px !important;
       z-index: 10000 !important;
    }
  `
}

function createStyleElement() {
  const style = document.createElement('style')
  style.id = 'dynamic-toast-style'
  document.head.appendChild(style)
  return style
}

watch(
  () => settingStore.get('Comfy.UseNewMenu'),
  () => nextTick(updateToastPosition),
  { immediate: true }
)
watch(
  () => settingStore.get('Comfy.Sidebar.Location'),
  () => nextTick(updateToastPosition),
  { immediate: true }
)
</script>
