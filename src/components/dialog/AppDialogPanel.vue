<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'

const {
  size = 'default',
  class: className,
  bodyClass,
  unpadded = false,
  onClose
} = defineProps<{
  size?: 'compact' | 'default'
  class?: HTMLAttributes['class']
  bodyClass?: HTMLAttributes['class']
  unpadded?: boolean
  onClose?: () => void
}>()

const { t } = useI18n()
</script>

<template>
  <DialogPanel
    :close-label="t('g.close')"
    :on-close
    :class="
      cn('w-full', size === 'compact' ? 'max-w-90' : 'max-w-lg', className)
    "
  >
    <template #title><slot name="title" /></template>
    <slot v-if="unpadded" />
    <div v-else :class="cn('p-4', bodyClass)"><slot /></div>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </DialogPanel>
</template>
