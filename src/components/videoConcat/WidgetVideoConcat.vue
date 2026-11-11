<template>
  <div class="w-full" :data-widget-name="widget.name">
    <VideoConcatPanel
      :clips="orderedClips"
      :result-url="resultUrl"
      @reorder="reorder"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VideoConcatPanel from '@/components/videoConcat/VideoConcatPanel.vue'
import { useVideoConcatClips } from '@/composables/videoConcat/useVideoConcatClips'
import { useVideoConcatOrder } from '@/composables/videoConcat/useVideoConcatOrder'
import type {
  IWidgetVideoConcatOptions,
  VideoConcatValue
} from '@comfyorg/graph-model/widgets'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { useWidgetHostNode } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetHostNode'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<VideoConcatValue, IWidgetVideoConcatOptions>
  nodeId: NodeId
}>()

const modelValue = defineModel<VideoConcatValue>({
  default: () => ({})
})

const node = useWidgetHostNode(
  () => widget.nodeLocatorId,
  () => nodeId
)

const clips = useVideoConcatClips(node, () => widget.options?.source ?? '')

const { orderedClips, reorder } = useVideoConcatOrder(modelValue, clips)

const nodeOutputStore = useNodeOutputStore()
const resultUrl = computed(() =>
  node.value ? nodeOutputStore.getNodeImageUrls(node.value)?.[0] : undefined
)
</script>
