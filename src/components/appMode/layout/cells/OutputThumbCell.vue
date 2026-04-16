<script setup lang="ts">
/**
 * OutputThumbCell — one grid-unit (48×48) history thumbnail rendered
 * in the layout grid's left column. Replaces LinearPreview's built-in
 * horizontal history strip when App Mode is in layout/semi-customizable
 * layout. Clicking sets the shared linearOutputStore selection; the
 * (hidden but still mounted) OutputHistory inside LinearPreview reacts
 * and emits updateSelection, which drives the main canvas.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { getMediaType } from '@/renderer/extensions/linearMode/mediaTypes'
import type { ResultItemImpl } from '@/stores/queueStore'

const props = defineProps<{
  asset: AssetItem
  output: ResultItemImpl
  /** Index of this output within the asset's outputs list. */
  outputIndex?: number
}>()

const store = useLinearOutputStore()
const { selectedId } = storeToRefs(store)

const selectionId = computed(
  () => `history:${props.asset.id}:${props.outputIndex ?? 0}`
)

const isActive = computed(() => selectedId.value === selectionId.value)

function onClick() {
  store.select(selectionId.value)
}
</script>

<template>
  <button
    type="button"
    class="output-thumb"
    :data-active="isActive"
    :aria-pressed="isActive"
    @click="onClick"
  >
    <img
      v-if="getMediaType(output) === 'images'"
      class="output-thumb__media"
      loading="lazy"
      :src="output.url"
      :alt="asset.name ?? 'output thumbnail'"
    />
    <video
      v-else-if="getMediaType(output) === 'video'"
      class="output-thumb__media"
      preload="metadata"
      :src="output.url"
      muted
    />
    <i v-else class="output-thumb__icon icon-[lucide--file]" />
  </button>
</template>

<style scoped>
.output-thumb {
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  border: 2px solid transparent;
  border-radius: var(--layout-cell-radius);
  background-color: var(--layout-color-cell-fill);
  cursor: pointer;
  overflow: hidden;
  transition: border-color var(--layout-transition-duration)
    var(--layout-transition-easing);
}

.output-thumb:hover {
  border-color: rgb(255 255 255 / 0.2);
}

.output-thumb[data-active='true'] {
  border-color: var(--layout-color-cell-hover);
}

.output-thumb__media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.output-thumb__icon {
  width: 60%;
  height: 60%;
  margin: auto;
  color: var(--layout-color-text-muted);
}
</style>
