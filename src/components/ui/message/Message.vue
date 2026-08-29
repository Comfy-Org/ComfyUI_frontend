<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

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
const role = computed(() => (severity === 'error' ? 'alert' : 'status'))

function close(event: MouseEvent) {
  visible.value = false
  emit('close', event)
}
</script>

<template>
  <div
    v-if="visible"
    :role
    :class="cn(messageVariants({ severity }), customClass)"
  >
    <span v-if="$slots.icon || icon" class="shrink-0" aria-hidden="true">
      <slot name="icon"><i :class="icon" /></slot>
    </span>
    <div class="min-w-0 flex-1"><slot /></div>
    <button
      v-if="closable"
      type="button"
      class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-current hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
      :aria-label="t('g.close')"
      @click="close"
    >
      <i class="icon-[lucide--x] size-4" aria-hidden="true" />
    </button>
  </div>
</template>
