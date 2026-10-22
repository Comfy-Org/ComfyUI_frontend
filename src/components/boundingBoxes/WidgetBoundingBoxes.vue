<template>
  <BoundingBoxesEditor v-model="modelValue" :node-id :widget>
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
import Button from '@/components/ui/button/Button.vue'
import type { BoundingBox } from '@/types/boundingBoxes'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { nodeId, widget } = defineProps<{
  nodeId: NodeId
  widget: SimplifiedWidget
}>()
const modelValue = defineModel<BoundingBox[]>({ default: () => [] })

async function openFullscreen() {
  const { openBoundingBoxesDialog } =
    await import('@/components/boundingBoxes/boundingBoxesDialog')
  openBoundingBoxesDialog(nodeId, widget)
}
</script>
