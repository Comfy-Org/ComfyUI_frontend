<template>
  <div class="w-full" :data-widget-name="widget.name">
    <VideoEditPanel
      v-model:start-frame="startFrame"
      v-model:end-frame="endFrame"
      v-model:crop-bounds="cropBounds"
      :features="features"
      :video-url="videoUrl"
      :thumbnail="thumbnail"
      :total-frames="totalFrames"
      :duration="duration"
      :fps="fps"
      :file-size="fileSize"
      :width="width"
      :height="height"
      :loading="loading"
      :error="error"
      @retry="retry"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import VideoEditPanel from '@/components/videoEdit/VideoEditPanel.vue'
import { useVideoEditModel } from '@/composables/video/useVideoEditModel'
import { useVideoFilmstrip } from '@/composables/video/useVideoFilmstrip'
import { useVideoSourceUrl } from '@/composables/video/useVideoSourceUrl'
import type {
  IWidgetVideoEditOptions,
  VideoEditFeature,
  VideoEditValue
} from '@/lib/litegraph/src/types/widgets'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<VideoEditValue, IWidgetVideoEditOptions>
  nodeId: NodeId
}>()

const modelValue = defineModel<VideoEditValue>({
  default: () => ({})
})

const features = computed(
  (): VideoEditFeature[] => widget.options?.features ?? ['trim', 'crop']
)

const node = computed(() => {
  const locatorId = widget.nodeLocatorId
  const owner = locatorId && getNodeByLocatorId(app.rootGraph, locatorId)
  return owner || app.canvas.graph?.getNodeById(nodeId)
})

const { videoUrl } = useVideoSourceUrl(node)

const {
  thumbnail,
  duration,
  totalFrames,
  width,
  height,
  fps,
  fileSize,
  loading,
  error,
  retry
} = useVideoFilmstrip(videoUrl)

const { startFrame, endFrame, cropBounds } = useVideoEditModel(modelValue, {
  duration,
  totalFrames,
  fps,
  width,
  height
})
</script>
