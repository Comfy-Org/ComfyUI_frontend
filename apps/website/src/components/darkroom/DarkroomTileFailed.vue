<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { FailedSlot } from '@/lib/darkroom/feed'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  tile,
  retryable,
  locale = 'en'
} = defineProps<{
  tile: FailedSlot
  retryable: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ retry: [] }>()

const status = computed(() =>
  tile.cancelled
    ? { label: t('darkroom.tile.cancelled'), dot: 'bg-content-muted' }
    : { label: t('darkroom.tile.failed'), dot: 'bg-destructive-light' }
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-xl border border-transparency-white-t20 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-warm-white uppercase"
  >
    <span :class="cn('size-1.5 shrink-0 rounded-full', status.dot)" />
    {{ status.label }}
  </span>
  <p class="text-base text-primary-warm-white">
    {{ t(`darkroom.failure.${tile.failure}.title`) }}
  </p>
  <p class="text-sm/snug text-content-muted">
    {{ t(`darkroom.failure.${tile.failure}.message`) }}
  </p>
  <button
    v-if="retryable"
    type="button"
    class="cursor-pointer rounded-xl border border-transparency-white-t20 px-3 py-2 text-xs font-bold tracking-wider text-primary-warm-white uppercase hover:border-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink"
    @click.stop="emit('retry')"
  >
    {{ t('darkroom.tile.tryAgain') }}
  </button>
  <details v-if="tile.detail" class="w-full text-xs text-content-muted">
    <summary class="cursor-pointer">
      {{ t('darkroom.tile.details') }}
    </summary>
    <pre
      class="mt-1.5 max-h-28 overflow-auto text-xs wrap-break-word whitespace-pre-wrap text-content"
      >{{ tile.detail }}</pre>
  </details>
</template>
