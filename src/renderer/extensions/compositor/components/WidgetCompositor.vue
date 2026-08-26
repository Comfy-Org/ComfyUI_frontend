<template>
  <div class="widget-expands flex size-full flex-col gap-1" @pointerdown.stop>
    <div
      class="group/preview relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-node-component-surface"
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
      <span
        v-else
        class="text-xs text-muted-foreground"
        data-testid="compositor-empty"
      >
        {{ t('compositor.empty') }}
      </span>
      <div
        v-if="canOpen"
        class="invisible absolute top-2 right-2 group-focus-within/preview:visible group-hover/preview:visible"
      >
        <button
          :class="actionButtonClass"
          :disabled="exporting"
          :title="t('compositor.downloadPsd')"
          :aria-label="t('compositor.downloadPsd')"
          data-testid="compositor-download-psd"
          @click="onDownloadPsd"
        >
          <i class="icon-[lucide--download] size-4" />
        </button>
      </div>
    </div>

    <div
      v-if="dimensionsLabel"
      class="text-center text-xs text-muted-foreground"
      data-testid="compositor-dimensions"
    >
      {{ dimensionsLabel }}
    </div>

    <Button
      variant="secondary"
      size="md"
      class="w-full gap-2"
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

const actionButtonClass =
  'flex h-8 min-h-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-base-foreground p-2 text-base-background shadow-interface transition-colors duration-200 hover:bg-base-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-50'

const naturalSize = ref<{ w: number; h: number } | null>(null)
const outputUrl = ref<string | null>(null)

const litegraphNode = computed(() => {
  if (!nodeId || !app.canvas.graph) return null
  return app.canvas.graph.getNodeById(nodeId) ?? null
})

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
