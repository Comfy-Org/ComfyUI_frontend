<script setup lang="ts">
import { RefreshCw, X } from '@lucide/vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorFileButton from '../app-editor/EditorFileButton.vue'
import VirtualTryOnGarmentEmpty from './VirtualTryOnGarmentEmpty.vue'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { garment, phase } = tryOn

function drop(event: DragEvent) {
  const file = event.dataTransfer?.files[0]
  if (file) tryOn.useGarmentFile(file)
}
</script>

<template>
  <aside
    :aria-label="vc('tryOn.garment', locale)"
    class="absolute top-3 right-3 w-20 sm:w-32"
    data-testid="try-on-garment-card"
    @dragover.prevent
    @drop.prevent="drop"
  >
    <figure
      v-if="garment"
      class="relative m-0 overflow-hidden rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink-light/90 shadow-xl shadow-black/40 backdrop-blur-md"
    >
      <img
        :src="garment.url"
        :alt="vc('tryOn.alt.garment', locale, { name: garment.name })"
        class="aspect-square w-full bg-primary-warm-white object-cover"
      />
      <figcaption class="flex flex-col px-2 py-1.5">
        <span class="text-[10px] text-primary-warm-gray">{{
          vc('tryOn.garment', locale)
        }}</span>
        <span class="truncate text-xs text-primary-warm-white">{{
          garment.name
        }}</span>
      </figcaption>
      <span class="absolute top-1.5 right-1.5 flex gap-1">
        <EditorFileButton
          :label="vc('tryOn.garment.replace', locale)"
          :disabled="phase.kind === 'running'"
          class="grid size-6 place-items-center rounded-full bg-primary-comfy-ink/75 text-primary-warm-white transition hover:bg-primary-comfy-ink focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/60 focus-visible:outline-none disabled:opacity-40"
          @file="tryOn.useGarmentFile"
        >
          <RefreshCw class="size-3" aria-hidden="true" />
        </EditorFileButton>
        <button
          type="button"
          :aria-label="vc('tryOn.garment.remove', locale)"
          :title="vc('tryOn.garment.remove', locale)"
          :disabled="phase.kind === 'running'"
          class="grid size-6 place-items-center rounded-full bg-primary-comfy-ink/75 text-primary-warm-white transition hover:bg-primary-comfy-ink focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/60 focus-visible:outline-none disabled:opacity-40"
          @click="tryOn.removeGarment"
        >
          <X class="size-3" aria-hidden="true" />
        </button>
      </span>
    </figure>
    <VirtualTryOnGarmentEmpty v-else :locale @file="tryOn.useGarmentFile" />
  </aside>
</template>
