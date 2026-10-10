<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  message,
  undoable = false,
  locale = 'en'
} = defineProps<{
  /** Nothing to say hides the notice. */
  message?: string
  undoable?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ undo: [] }>()
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    :class="
      cn(
        'fixed bottom-6 left-1/2 z-80 flex max-w-[90vw] -translate-x-1/2 items-center gap-4 rounded-2xl bg-primary-warm-white px-4.5 py-2.5 text-base text-primary-comfy-ink transition-[opacity,translate] duration-200',
        !message && 'pointer-events-none translate-y-4 opacity-0',
        undoable && 'py-1.5 pr-2'
      )
    "
    data-testid="darkroom-toast"
  >
    {{ message }}
    <button
      v-if="undoable"
      type="button"
      class="cursor-pointer rounded-xl bg-primary-comfy-ink px-3 py-2 text-xs font-bold tracking-wider text-primary-warm-white uppercase hover:bg-primary-comfy-ink-light"
      @click="emit('undo')"
    >
      {{ t('darkroom.toast.undo') }}
    </button>
  </div>
</template>
