<template>
  <div class="widget-expands flex size-full flex-col gap-1" @pointerdown.stop>
    <div
      class="group/preview relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-node"
      data-testid="compositor-preview-area"
      @dblclick.stop="openEditor"
    >
      <img
        v-if="previewUrl"
        :src="previewUrl"
        class="max-h-full max-w-full object-contain"
        draggable="false"
        data-testid="compositor-preview"
        @load="onPreviewLoad"
        @dragstart.prevent
      />
      <span v-else class="text-muted-foreground" data-testid="compositor-empty">
        {{ t('compositor.empty') }}
      </span>
      <div
        v-if="canOpen"
        class="invisible absolute top-2 right-2 group-focus-within/preview:visible group-hover/preview:visible"
      >
        <Button
          variant="inverted"
          size="icon"
          class="shadow-md"
          :disabled="exporting"
          :title="t('compositor.downloadPsd')"
          :aria-label="t('compositor.downloadPsd')"
          data-testid="compositor-download-psd"
          @click="onDownloadPsd"
        >
          <i class="icon-[lucide--download] size-4" />
        </Button>
      </div>
    </div>

    <div
      v-if="dimensionsLabel"
      class="text-center text-muted-foreground"
      data-testid="compositor-dimensions"
    >
      {{ dimensionsLabel }}
    </div>

    <Button
      variant="secondary"
      size="md"
      class="w-full"
      :disabled="!canOpen"
      :title="canOpen ? undefined : t('compositor.runWorkflowFirst')"
      data-testid="compositor-open-button"
      @click="openEditor"
    >
      <i class="icon-[lucide--layers] size-4" />
      {{ t('compositor.open') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useCompositorEditor } from '@/renderer/extensions/compositor/composables/useCompositorEditor'
import {
  getCompositorPreviewOverride,
  hasCompositorLayers
} from '@/renderer/extensions/compositor/composables/useCompositorLayers'
import { useCompositorPsdDownload } from '@/renderer/extensions/compositor/composables/useCompositorPsdDownload'
import { useLiveGraphNode } from '@/composables/useLiveGraphNode'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { NodeId } from '@/types/nodeId'

const { nodeId } = defineProps<{
  nodeId: NodeId
}>()

const { t } = useI18n()
const nodeOutputStore = useNodeOutputStore()
const { openCompositorEditor } = useCompositorEditor()
const { exporting, downloadPsd } = useCompositorPsdDownload()

const naturalSize = ref<{ w: number; h: number } | null>(null)
const outputUrl = ref<string | null>(null)

const litegraphNode = useLiveGraphNode(() =>
  nodeId ? app.canvas.graph?.getNodeById(nodeId) : null
)

function updateOutputUrl(): void {
  const node = litegraphNode.value
  outputUrl.value = node
    ? (nodeOutputStore.getNodeImageUrls(node)?.[0] ?? null)
    : null
}

watch(() => nodeOutputStore.nodeOutputs, updateOutputUrl, {
  deep: true,
  immediate: true
})
watch(() => nodeOutputStore.nodePreviewImages, updateOutputUrl, { deep: true })
watch(litegraphNode, updateOutputUrl)

const previewUrl = computed(() => {
  const node = litegraphNode.value
  const override = node ? getCompositorPreviewOverride(node) : undefined
  return override ?? outputUrl.value
})

watch(previewUrl, () => {
  naturalSize.value = null
})

const dimensionsLabel = computed(() =>
  naturalSize.value ? `${naturalSize.value.w} × ${naturalSize.value.h}` : null
)

const canOpen = computed(() => {
  const node = litegraphNode.value
  return !!node && hasCompositorLayers(node)
})

function onPreviewLoad(event: Event): void {
  const img = event.target as HTMLImageElement
  naturalSize.value = { w: img.naturalWidth, h: img.naturalHeight }
}

function openEditor(): void {
  const node = litegraphNode.value
  if (node) openCompositorEditor(node)
}

function onDownloadPsd(): void {
  const node = litegraphNode.value
  if (node) void downloadPsd(node)
}
</script>
