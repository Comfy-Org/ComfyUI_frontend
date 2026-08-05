<template>
  <div class="widget-expands flex size-full flex-col gap-1" @pointerdown.stop>
    <div
      class="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-node-component-surface"
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
import { useCompositorEditor } from '@/composables/compositor/useCompositorEditor'
import {
  getCompositorPreviewOverride,
  hasCompositorLayers
} from '@/composables/compositor/useCompositorLayers'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { NodeId } from '@/types/nodeId'

const { nodeId } = defineProps<{
  nodeId: NodeId
}>()

const { t } = useI18n()
const nodeOutputStore = useNodeOutputStore()
const { openCompositorEditor } = useCompositorEditor()

const naturalSize = ref<{ w: number; h: number } | null>(null)
const outputUrl = ref<string | null>(null)

const litegraphNode = computed(() => {
  if (!nodeId || !app.canvas.graph) return null
  return app.canvas.graph.getNodeById(nodeId)
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

const previewUrl = computed(
  () => getCompositorPreviewOverride(nodeId) ?? outputUrl.value
)

watch(previewUrl, () => {
  naturalSize.value = null
})

const dimensionsLabel = computed(() =>
  naturalSize.value ? `${naturalSize.value.w} × ${naturalSize.value.h}` : null
)

const canOpen = computed(() => hasCompositorLayers(nodeId))

function onPreviewLoad(event: Event): void {
  const img = event.target as HTMLImageElement
  naturalSize.value = { w: img.naturalWidth, h: img.naturalHeight }
}

function openEditor(): void {
  const node = litegraphNode.value
  if (node) openCompositorEditor(node)
}
</script>
