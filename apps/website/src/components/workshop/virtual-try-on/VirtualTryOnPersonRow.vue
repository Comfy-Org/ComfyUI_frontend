<script setup lang="ts">
import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorFileButton from '../app-editor/EditorFileButton.vue'
import VirtualTryOnDropZone from './VirtualTryOnDropZone.vue'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { person } = tryOn
</script>

<template>
  <VirtualTryOnDropZone
    class="flex items-center gap-3 rounded-xl px-1 pt-2 pb-3"
    data-testid="try-on-person-row"
    @file="tryOn.usePersonFile"
  >
    <img :src="person.url" alt="" class="size-10 rounded-lg object-cover" />
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="text-[11px] text-primary-warm-gray">{{
        vc('tryOn.person', locale)
      }}</span>
      <span class="truncate text-xs text-primary-warm-white">{{
        person.name
      }}</span>
    </span>
    <EditorFileButton
      :label="vc('tryOn.person.changeLabel', locale)"
      class="h-7 shrink-0 rounded-full bg-transparency-white-t8 px-3 text-xs text-primary-warm-white transition hover:bg-transparency-white-t20 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
      @file="tryOn.usePersonFile"
    >
      {{ vc('tryOn.person.change', locale) }}
    </EditorFileButton>
  </VirtualTryOnDropZone>
</template>
