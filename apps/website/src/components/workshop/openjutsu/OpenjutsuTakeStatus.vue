<script setup lang="ts">
import { CircleStop, LoaderCircle } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SwapTake } from '@/lib/workshop/openjutsu/take'
import { stoppedNote, takeOverlay } from '@/lib/workshop/openjutsu/take'

/** What sits over the player while a take renders, or after it stopped. */
const { take, locale = 'en' } = defineProps<{
  take?: SwapTake
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
const stock = {
  cancelled: t('reshoot.take.cancelled'),
  failed: t('reshoot.error.failed')
}
</script>

<template>
  <div
    v-if="take && overlay === 'progress'"
    role="status"
    class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-primary-comfy-ink/80 px-6 text-center"
    data-testid="openjutsu-progress"
  >
    <LoaderCircle
      class="size-7 text-primary-comfy-yellow motion-safe:animate-spin"
      aria-hidden="true"
    />
    <p class="text-base font-semibold text-primary-warm-white">
      {{ t(PHASES[take.phase ?? 'running']) }}
    </p>
    <p class="max-w-sm text-xs/relaxed text-primary-warm-gray">
      {{ t('openjutsu.phase.note') }}
    </p>
    <Button
      variant="outline"
      size="sm"
      class="rounded-full"
      data-testid="openjutsu-cancel"
      @click="emit('cancel')"
    >
      {{ t('reshoot.cancel') }}
    </Button>
  </div>
  <div
    v-else-if="take && overlay === 'stopped'"
    role="alert"
    class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-primary-comfy-ink/80 px-6 text-center"
    data-testid="openjutsu-failed"
  >
    <CircleStop class="size-7 text-primary-comfy-canvas" aria-hidden="true" />
    <p class="max-w-md text-sm text-primary-warm-white">
      {{ stoppedNote(take, stock) }}
    </p>
    <Button
      variant="outline"
      size="sm"
      class="rounded-full"
      @click="emit('retry', take.id)"
    >
      {{ t('openjutsu.take.retry') }}
    </Button>
  </div>
</template>
