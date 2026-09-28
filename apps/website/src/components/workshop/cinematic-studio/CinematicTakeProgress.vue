<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
import { useTimestamp } from '@vueuse/core'
import { computed } from 'vue'

import { formatElapsed } from '../../../config/workshop-run'
import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const LONG_WAIT_MS = 30_000

const {
  take,
  locale = 'en'
} = defineProps<{
  take: Take
  locale?: Locale
}>()

const now = useTimestamp({ interval: 1000 })
const elapsed = computed(() => Math.max(0, now.value - take.startedAt))
</script>

<template>
  <img
    v-if="take.preview"
    :src="take.preview"
    alt=""
    class="absolute inset-0 size-full scale-125 object-cover opacity-40 blur-3xl saturate-50"
  />
  <p
    v-if="elapsed >= LONG_WAIT_MS"
    class="absolute inset-x-4 top-4 mx-auto w-fit rounded-full border border-transparency-white-t8 bg-primary-comfy-ink/80 px-3.5 py-2 text-center text-xs text-primary-comfy-canvas"
  >
    {{ tc('cinematic.stage.longWait', locale) }}
  </p>
  <figcaption
    role="status"
    class="absolute bottom-4 left-5 flex items-center gap-2.5 text-[13px] text-primary-warm-white"
  >
    <LoaderCircle
      class="size-4 text-primary-comfy-yellow motion-safe:animate-spin"
      aria-hidden="true"
    />
    {{
      tc('cinematic.stage.takeName', locale, {
        shot: take.shot,
        take: take.letter
      })
    }}
    <span class="font-mono text-primary-comfy-canvas tabular-nums">
      {{ formatElapsed(elapsed) }}
    </span>
  </figcaption>
</template>
