<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import type { MessageVariants } from './message.variants'
import { messageVariants } from './message.variants'

const {
  severity,
  closable = false,
  class: customClass = ''
} = defineProps<{
  severity?: MessageVariants['severity']
  closable?: boolean
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{ close: [event: MouseEvent] }>()
const visible = defineModel<boolean>('visible', { default: true })

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
    <span v-if="$slots.icon" class="shrink-0" aria-hidden="true">
      <slot name="icon" />
    </span>
    <div class="min-w-0 flex-1"><slot /></div>
    <Button
      v-if="closable"
      type="button"
      variant="textonly"
      size="unset"
      class="size-6 shrink-0 p-0 text-current"
      :aria-label="$t('g.close')"
      @click="close"
    >
      <i class="icon-[lucide--x] size-4" aria-hidden="true" />
    </Button>
  </div>
</template>
