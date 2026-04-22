<script setup lang="ts">
/**
 * OutputThumbCell — one grid-unit (48×48) history thumbnail rendered
 * in the layout grid's left column. Replaces LinearPreview's built-in
 * horizontal history strip when App Mode is in layout/semi-customizable
 * layout. Clicking sets the shared linearOutputStore selection; the
 * (hidden but still mounted) OutputHistory inside LinearPreview reacts
 * and emits updateSelection, which drives the main canvas.
 *
 * Media rendering (image/video/fallback-icon + video-play overlay) is
 * delegated to OutputHistoryItem so we only own the button wrapper and
 * selection state. That keeps the mediaType fan-out — including future
 * additions like audio/3d — in one place.
 *
 * The [&_img], [&_video], [&_i] arbitrary variants stretch
 * OutputHistoryItem's size-10 (40×40) elements to fill our 48×48 cell.
 */
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import OutputHistoryItem from '@/renderer/extensions/linearMode/OutputHistoryItem.vue'
import type { ResultItemImpl } from '@/stores/queueStore'

const { t } = useI18n()

const {
  asset,
  output,
  outputIndex = 0
} = defineProps<{
  asset: AssetItem
  output: ResultItemImpl
  /** Index of this output within the asset's outputs list. */
  outputIndex?: number
}>()

const store = useLinearOutputStore()
const { selectedId } = storeToRefs(store)

const selectionId = computed(() => `history:${asset.id}:${outputIndex}`)

const isActive = computed(() => selectedId.value === selectionId.value)

function onClick() {
  store.select(selectionId.value)
}
</script>

<template>
  <button
    type="button"
    :class="[
      'm-0 flex size-full cursor-pointer overflow-hidden rounded-layout-cell border-2 border-transparent bg-layout-cell p-0',
      'duration-layout transition-[border-color] ease-layout',
      'hover:border-white/20',
      'data-[active=true]:border-layout-cell-hover',
      '[&_img]:pointer-events-none [&_img]:size-full [&_img]:object-cover',
      '[&_video]:pointer-events-none [&_video]:size-full [&_video]:object-cover',
      '[&_i]:m-auto [&_i]:size-3/5 [&_i]:text-layout-mute'
    ]"
    :data-active="isActive"
    :aria-pressed="isActive"
    :aria-label="asset.name ?? t('linearMode.outputThumbAlt')"
    @click="onClick"
  >
    <OutputHistoryItem :output="output" />
  </button>
</template>
