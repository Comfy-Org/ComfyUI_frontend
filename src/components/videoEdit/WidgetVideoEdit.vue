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
      :has-source="hasSource"
      :loading="loading"
      :error="error"
      @load-error="onError"
      @retry="retry"
      @edit-end="commitAfterUpdate"
    >
      <template #history>
        <WidgetHistoryButtons :can-undo :can-redo @undo="undo" @redo="redo" />
      </template>
    </VideoEditPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'

import VideoEditPanel from '@/components/videoEdit/VideoEditPanel.vue'
import WidgetHistoryButtons from '@/components/widgetHistory/WidgetHistoryButtons.vue'
import { useWidgetValueHistory } from '@/composables/useWidgetValueHistory'
import { widgetHistoryScope } from '@/composables/widgetHistoryScope'
import { useVideoEditModel } from '@/composables/video/useVideoEditModel'
import { useVideoFilmstrip } from '@/composables/video/useVideoFilmstrip'
import type { FilmstripError } from '@/composables/video/useVideoFilmstrip'
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

const { videoUrl, status, onError, retry } = useVideoSourceUrl(node)

const {
  thumbnail,
  duration,
  totalFrames,
  width,
  height,
  fps,
  fileSize,
  loading: filmstripLoading,
  error: filmstripError
} = useVideoFilmstrip(videoUrl)

watch(filmstripError, (error) => {
  if (error === 'load-failed') onError()
})

const hasSource = computed(() => status.value !== 'idle')
const loading = computed(
  () =>
    status.value !== 'failed' &&
    (filmstripLoading.value || status.value === 'retrying')
)
const error = computed<FilmstripError | null>(() => {
  if (filmstripError.value === 'canvas-unavailable') return 'canvas-unavailable'
  return status.value === 'failed' ? 'load-failed' : null
})

const { startFrame, endFrame, cropBounds } = useVideoEditModel(modelValue, {
  duration,
  totalFrames,
  fps,
  width,
  height
})

function isVideoEditValue(value: unknown): value is VideoEditValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const { canUndo, canRedo, undo, redo, commit, syncBaseline } =
  useWidgetValueHistory({
    scope: () => widgetHistoryScope(widget, nodeId),
    read: () => modelValue.value,
    apply: (value) => {
      if (isVideoEditValue(value)) modelValue.value = value
    }
  })
void nextTick(syncBaseline)

function commitAfterUpdate(mergeKey?: string) {
  void nextTick(() => commit(mergeKey))
}
</script>
