<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { CircleStop, LoaderCircle } from '@lucide/vue'
import { useTimestamp } from '@vueuse/core'
import { computed } from 'vue'

import type { ReshootTake } from '@/composables/useReshoot'
import { formatElapsed } from '@/config/workshop-run'
import type { Locale } from '@/i18n/translations'
import type { ReshootSound, ReshootView } from './output'

const {
  take,
  clip,
  view = 'result',
  sound = 'generated',
  locale = 'en'
} = defineProps<{
  take: ReshootTake
  clip: string
  view?: ReshootView
  sound?: ReshootSound
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const now = useTimestamp({ interval: 1000 })
const elapsed = computed(() => Math.max(0, now.value - take.startedAt))
const shown = computed(() => {
  if (view === 'source') return clip
  if (view === 'warp') return take.warpUrl ?? clip
  return sound === 'original' ? (take.originalUrl ?? take.url) : take.url
})
</script>

<template>
  <div
    class="relative grid size-full place-items-center overflow-hidden rounded-md bg-primary-comfy-ink"
  >
    <template v-if="take.status === 'done' && take.url">
      <video
        :key="`${take.id}-${view}-${sound}`"
        :src="shown"
        autoplay
        loop
        controls
        playsinline
        class="size-full object-contain"
      />
      <p
        v-if="view === 'warp' && !take.warpUrl"
        class="absolute inset-x-4 top-4 mx-auto w-fit max-w-md rounded-xl bg-primary-comfy-ink/85 px-3.5 py-2 text-center text-xs text-primary-comfy-canvas"
      >
        {{ t('reshoot.warpNote') }}
      </p>
    </template>
    <div
      v-else-if="take.status === 'rendering'"
      class="flex flex-col items-center gap-3"
    >
      <p
        role="status"
        class="flex items-center gap-2.5 text-sm text-primary-warm-white"
      >
        <LoaderCircle
          class="size-4 text-primary-comfy-yellow motion-safe:animate-spin"
          aria-hidden="true"
        />
        {{ t('reshoot.generating') }}
        <span class="font-mono text-primary-comfy-canvas tabular-nums">
          {{ formatElapsed(elapsed) }}
        </span>
      </p>
      <p class="max-w-xs text-center text-xs text-primary-warm-gray">
        {{
          t(
            take.phase === 'starting'
              ? 'reshoot.stage.starting'
              : take.phase === 'queued'
                ? 'reshoot.stage.queued'
                : 'reshoot.generatingHelp'
          )
        }}
      </p>
    </div>
    <div
      v-else-if="take.status === 'failed'"
      role="alert"
      class="flex max-w-md flex-col items-center gap-2 px-6 text-center"
    >
      <p class="flex items-center gap-2.5 text-sm text-primary-warm-white">
        <CircleStop class="size-4" aria-hidden="true" />
        {{ t('reshoot.take.failed') }}
      </p>
      <p class="text-xs wrap-break-word text-primary-warm-gray">
        {{ take.note }}
      </p>
    </div>
    <p
      v-else
      role="status"
      class="flex items-center gap-2.5 text-sm text-primary-comfy-canvas"
    >
      <CircleStop class="size-4" aria-hidden="true" />
      {{ t('reshoot.take.cancelled') }}
    </p>
  </div>
</template>
