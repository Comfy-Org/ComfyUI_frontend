<template>
  <BoundingBoxesEditor v-model="modelValue" :node-id :widget-id>
    <template #toolbar-end>
      <Button
        variant="textonly"
        size="icon"
        icon="icon-[lucide--maximize-2]"
        :aria-label="$t('boundingBoxes.openFullscreen')"
        :tooltip="$t('boundingBoxes.openFullscreen')"
        @click="openFullscreen"
      />
    </template>
  </BoundingBoxesEditor>
</template>

<script setup lang="ts">
import BoundingBoxesEditor from '@/components/boundingBoxes/BoundingBoxesEditor.vue'
import Button from '@comfyorg/design-system/button/Button'
import type { BoundingBox } from '@comfyorg/graph-model/boundingBoxes'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

const { nodeId, widgetId } = defineProps<{
  nodeId: NodeId
  widgetId: WidgetId
}>()
const modelValue = defineModel<BoundingBox[]>({ default: () => [] })

async function openFullscreen() {
  const { openBoundingBoxesDialog } =
    await import('@/components/boundingBoxes/boundingBoxesDialog')
  openBoundingBoxesDialog(nodeId, widgetId)
}
</script>
