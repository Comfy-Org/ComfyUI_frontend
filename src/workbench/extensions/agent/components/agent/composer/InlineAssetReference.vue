<script setup lang="ts">
import { useElementHover, useFocusWithin } from '@vueuse/core'
import { onBeforeUnmount, useTemplateRef, watch } from 'vue'

import type { MediaKind } from '@comfyorg/assets-core/media'

import AssetThumbnail from './AssetThumbnail.vue'
import InlineReferenceRemoveButton from './InlineReferenceRemoveButton.vue'

import { inlineReferenceChipClass } from './inlineReferenceChipStyles'

const { name, previewUrl, mediaKind, removeLabel } = defineProps<{
  name: string
  previewUrl?: string
  mediaKind?: MediaKind
  removeLabel: string
}>()
const emit = defineEmits<{ remove: []; highlight: [active: boolean] }>()
const chip = useTemplateRef<HTMLSpanElement>('chip')
const hovered = useElementHover(chip)
const { focused } = useFocusWithin(chip)
watch(
  () => hovered.value || focused.value,
  (active) => emit('highlight', active)
)
onBeforeUnmount(() => emit('highlight', false))
</script>

<template>
  <span
    ref="chip"
    data-testid="asset-reference-chip"
    tabindex="0"
    :class="inlineReferenceChipClass"
  >
    <AssetThumbnail
      :name
      :preview-url
      :media-kind
      variant="inline"
      class="size-4 shrink-0"
    />
    <span class="max-w-56 min-w-0 truncate">{{ name }}</span>
    <InlineReferenceRemoveButton
      :label="removeLabel"
      @remove="emit('remove')"
    />
  </span>
</template>
