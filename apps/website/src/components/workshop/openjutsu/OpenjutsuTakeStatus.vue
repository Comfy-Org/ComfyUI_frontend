<script setup lang="ts">
import { CircleStop } from '@lucide/vue'
import { computed } from 'vue'

import EditorBusy from '@/components/workshop/app-editor/EditorBusy.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SwapTake } from '@/lib/workshop/openjutsu/take'
import { stoppedNote, takeOverlay } from '@/lib/workshop/openjutsu/take'

/** What sits over the player while a take renders, or after it stopped. */
const {
  take,
  elapsedSeconds,
  locale = 'en'
} = defineProps<{
  take?: SwapTake
  /** How long the rendering take has been going. */
  elapsedSeconds?: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ cancel: []; retry: [id: string] }>()

const PHASES = {
  uploading: 'openjutsu.phase.uploading',
  starting: 'openjutsu.phase.starting',
  queued: 'openjutsu.phase.queued',
  running: 'openjutsu.phase.running',
  fetching: 'openjutsu.phase.fetching'
} as const

const overlay = computed(() => takeOverlay(take))
const elapsed = computed(() => {
  const seconds = Math.max(0, Math.floor(elapsedSeconds ?? 0))
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  return t('openjutsu.phase.elapsed', { time })
})
const stock = {
  cancelled: t('reshoot.take.cancelled'),
  failed: t('reshoot.error.failed')
}
</script>

<template>
  <EditorBusy
    v-if="take && overlay === 'progress'"
    :title="t(PHASES[take.phase ?? 'running'])"
    :detail="elapsed"
    :cancel-label="t('reshoot.cancel')"
    class="z-20"
    @cancel="emit('cancel')"
  />
  <div
    v-else-if="take && overlay === 'stopped'"
    role="alert"
    class="absolute inset-0 z-20 flex items-center justify-center rounded-sm bg-primary-comfy-ink/60 px-4"
  >
    <div
      class="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink-light px-5 py-4 text-center"
    >
      <CircleStop class="size-5 text-primary-comfy-canvas" aria-hidden="true" />
      <p class="text-sm text-primary-warm-white">
        {{ stoppedNote(take, stock) }}
      </p>
      <button
        type="button"
        class="h-8 rounded-full bg-transparency-white-t8 px-3.5 text-xs font-semibold text-primary-warm-white transition hover:bg-transparency-white-t20 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @click="emit('retry', take.id)"
      >
        {{ t('openjutsu.take.retry') }}
      </button>
    </div>
  </div>
</template>
