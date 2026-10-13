<script setup lang="ts">
import { ImageOff } from '@lucide/vue'
import { computed } from 'vue'

import type { PaparazziMe } from '@/composables/usePaparazziMe'
import type { Locale } from '@/i18n/translations'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import EditorFrame from '@/components/workshop/app-editor/EditorFrame.vue'
import { sceneName } from './sections'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { scene, setup } = paparazzi
const photo = computed(() => {
  const current = scene.value
  if (!current) return undefined
  return current.kind === 'own'
    ? current.image
    : { url: current.candidate.place.url, width: 3, height: 2 }
})
const alt = computed(() =>
  scene.value?.kind === 'own'
    ? pc('paparazzi.scene.own', locale)
    : pc('paparazzi.alt.scene', locale, {
        name: setup.value.celebrity.trim(),
        scene: sceneName(paparazzi, locale)
      })
)
</script>

<template>
  <EditorFrame :width="photo?.width ?? 3" :height="photo?.height ?? 2">
    <div
      class="relative size-full overflow-hidden rounded-sm bg-primary-comfy-ink-light shadow-2xl shadow-black/50"
      data-testid="paparazzi-stage"
    >
      <img
        v-if="photo"
        :src="photo.url"
        :alt
        draggable="false"
        class="size-full object-cover"
      />
      <div
        v-else
        class="flex size-full flex-col items-center justify-center gap-2 text-sm text-primary-warm-gray"
      >
        <ImageOff class="size-6" aria-hidden="true" />
        {{ pc('paparazzi.scene.idle', locale) }}
      </div>
      <slot />
    </div>
  </EditorFrame>
</template>
