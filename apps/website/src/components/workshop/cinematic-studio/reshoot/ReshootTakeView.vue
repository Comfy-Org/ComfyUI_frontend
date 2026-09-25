<script setup lang="ts">
import { CircleStop, Download, LoaderCircle } from '@lucide/vue'
import { useTimestamp } from '@vueuse/core'
import { computed } from 'vue'

import type { ReshootTake } from '../../../../composables/useReshootDemo'
import { formatElapsed } from '../../../../config/workshop-run'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

const { take, locale = 'en' } = defineProps<{
  take: ReshootTake
  locale?: Locale
}>()

const now = useTimestamp({ interval: 1000 })
const elapsed = computed(() => Math.max(0, now.value - take.startedAt))
</script>

<template>
  <div
    class="relative grid size-full place-items-center overflow-hidden rounded-md bg-primary-comfy-ink"
  >
    <template v-if="take.status === 'done' && take.url">
      <video
        :key="take.id"
        :src="take.url"
        autoplay
        loop
        controls
        playsinline
        class="max-h-full max-w-full"
      />
      <a
        :href="take.url"
        download
        class="absolute top-3 right-3 flex h-8 items-center gap-1.5 rounded-full bg-primary-comfy-ink/80 px-3 text-xs text-primary-warm-white hover:bg-primary-comfy-ink"
      >
        <Download class="size-3.5" aria-hidden="true" />
        {{ rc('reshoot.download', locale) }}
      </a>
    </template>
    <p
      v-else-if="take.status === 'rendering'"
      role="status"
      class="flex items-center gap-2.5 text-sm text-primary-warm-white"
    >
      <LoaderCircle
        class="size-4 text-primary-comfy-yellow motion-safe:animate-spin"
        aria-hidden="true"
      />
      {{ rc('reshoot.generating', locale) }}
      <span class="font-mono text-primary-comfy-canvas tabular-nums">
        {{ formatElapsed(elapsed) }}
      </span>
    </p>
    <p
      v-else
      role="status"
      class="flex items-center gap-2.5 text-sm text-primary-comfy-canvas"
    >
      <CircleStop class="size-4" aria-hidden="true" />
      {{ rc('reshoot.take.cancelled', locale) }}
    </p>
  </div>
</template>
