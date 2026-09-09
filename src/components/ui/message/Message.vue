<script setup lang="ts">
import { ref } from 'vue'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'

import type { MessageVariants } from './message.variants'
import { messageVariants } from './message.variants'

const {
  severity = 'info',
  closable = false,
  icon,
  class: customClass = ''
} = defineProps<{
  severity?: MessageVariants['severity']
  closable?: boolean
  icon?: string
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{ close: [event: MouseEvent] }>()
const { t } = useI18n()
const visible = ref(true)

function close(event: MouseEvent) {
  visible.value = false
  emit('close', event)
}
</script>

<template>
  <div
    v-if="visible"
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
    :class="cn(messageVariants({ severity }), customClass)"
  >
    <span v-if="$slots.icon || icon" class="shrink-0" aria-hidden="true">
      <slot name="icon"><i :class="icon" /></slot>
    </span>
    <div class="min-w-0 flex-1"><slot /></div>
    <Button
      v-if="closable"
      type="button"
      variant="textonly"
      size="unset"
      class="size-6 shrink-0 p-0 text-current"
      :aria-label="t('g.close')"
      @click="close"
    >
      <i class="icon-[lucide--x] size-4" aria-hidden="true" />
    </Button>
  </div>
</template>
