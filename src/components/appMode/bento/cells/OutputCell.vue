<script setup lang="ts">
/**
 * OutputCell — bento cell hosting a single output node's latest result.
 *
 * Phase 2b: when a workflow has more than one selected output, the
 * first output stays in the hero OutputsCell (which wraps LinearPreview
 * and keeps history + progress + latent previews + welcome state).
 * Additional outputs render as OutputCells — lightweight per-node
 * media previews driven by the in-progress store for that node.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MediaOutputPreview from '@/renderer/extensions/linearMode/MediaOutputPreview.vue'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'

const props = defineProps<{
  nodeId: NodeId
}>()

const { t } = useI18n()
const linearStore = useLinearOutputStore()

// Latest image result produced by this specific output node (across
// whatever jobs are currently in flight or recently completed and
// still held in the in-progress list before history resolution).
const latestOutput = computed(() => {
  for (const item of linearStore.inProgressItems) {
    if (
      item.state === 'image' &&
      item.output &&
      String(item.output.nodeId) === String(props.nodeId)
    ) {
      return item.output
    }
  }
  return undefined
})
</script>

<template>
  <div class="output-cell">
    <MediaOutputPreview
      v-if="latestOutput"
      :output="latestOutput"
      class="output-cell__preview"
    />
    <div v-else class="output-cell__empty">
      {{ t('menu.run') }}
    </div>
  </div>
</template>

<style scoped>
.output-cell {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  align-items: stretch;
  justify-content: stretch;
  padding: 8px;
  box-sizing: border-box;
}

.output-cell__preview {
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.output-cell__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--bento-font-md);
  color: var(--bento-color-text-muted);
  opacity: 0.5;
}
</style>
