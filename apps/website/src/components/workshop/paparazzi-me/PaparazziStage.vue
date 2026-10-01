<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import { usePaparazziPreview } from '../../../composables/usePaparazziPreview'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import EditorFrame from '../app-editor/EditorFrame.vue'
import PaparazziSceneArt from './PaparazziSceneArt.vue'
import { sceneName } from './sections'

const {
  paparazzi,
  running,
  locale = 'en'
} = defineProps<{
  paparazzi: PaparazziMe
  running: boolean
  locale?: Locale
}>()

const { face, setup } = paparazzi
const preview = usePaparazziPreview(
  () => face.value,
  () => setup.value
)
const alt = computed(() =>
  pc('paparazzi.alt.preview', locale, {
    name: setup.value.celebrity.trim(),
    scene: sceneName(setup.value, locale)
  })
)
</script>

<template>
  <EditorFrame :width="3" :height="2">
    <div class="relative size-full" data-testid="paparazzi-stage">
      <div
        class="absolute inset-0 overflow-hidden rounded-sm bg-primary-comfy-ink-light shadow-2xl shadow-black/50"
      >
        <img
          v-if="preview"
          :src="preview"
          :alt
          draggable="false"
          class="size-full object-cover"
          data-testid="paparazzi-preview"
        />
        <div v-else role="img" :aria-label="alt" class="size-full">
          <PaparazziSceneArt :scene="setup.scene" />
        </div>
        <span
          :class="
            cn(
              'pointer-events-none absolute inset-0 bg-radial from-primary-warm-white/70 via-primary-warm-white/10 to-transparent opacity-0 transition-opacity',
              running && 'opacity-100 motion-safe:animate-pulse'
            )
          "
          aria-hidden="true"
        />
      </div>
      <slot />
    </div>
  </EditorFrame>
</template>
