<script setup lang="ts">
import { Upload } from '@lucide/vue'
import { computed } from 'vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorFileButton from '../app-editor/EditorFileButton.vue'
import EditorTiles from '../app-editor/EditorTiles.vue'
import VirtualTryOnDropZone from './VirtualTryOnDropZone.vue'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { garment, garments } = tryOn
const options = computed(() =>
  garments.value.map((option) => ({ id: option.id, label: option.name }))
)
const urlOf = (id: string) =>
  garments.value.find((option) => option.id === id)?.url
const picked = computed({
  get: () => garment.value?.id,
  set: (id?: string) => id && tryOn.pickGarment(id)
})
</script>

<template>
  <VirtualTryOnDropZone
    class="flex flex-col gap-3 rounded-xl pb-1"
    data-testid="try-on-garment-drop"
    @file="tryOn.useGarmentFile"
  >
    <EditorTiles
      v-model="picked"
      :label="vc('tryOn.garment', locale)"
      :options
      square
    >
      <template #tile="{ option }">
        <img
          :src="urlOf(option.id)"
          alt=""
          class="size-full bg-primary-warm-white object-cover"
        />
      </template>
    </EditorTiles>
    <EditorFileButton
      class="mx-1 flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-transparency-white-t20 text-xs text-primary-warm-gray transition hover:border-transparency-white-t40 hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
      @file="tryOn.useGarmentFile"
    >
      <Upload class="size-3.5" aria-hidden="true" />
      {{ vc('tryOn.garment.upload', locale) }}
    </EditorFileButton>
  </VirtualTryOnDropZone>
</template>
