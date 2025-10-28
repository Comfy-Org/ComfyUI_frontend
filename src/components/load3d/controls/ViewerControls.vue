<template>
  <div class="relative rounded-lg bg-smoke-700/30">
    <div class="flex flex-col gap-2">
      <Button class="p-button-rounded p-button-text" @click="openIn3DViewer">
        <i
          v-tooltip.right="{
            value: t('load3d.openIn3DViewer'),
            showDelay: 300
          }"
          class="pi pi-expand text-lg text-white"
        />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'

import Load3DViewerContent from '@/components/load3d/Load3dViewerContent.vue'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useLoad3dService } from '@/services/load3dService'
import { useDialogStore } from '@/stores/dialogStore'

const vTooltip = Tooltip

const { node } = defineProps<{
  node: LGraphNode
}>()

const openIn3DViewer = () => {
  const props = { node: node }

  useDialogStore().showDialog({
    key: 'global-load3d-viewer',
    title: t('load3d.viewer.title'),
    component: Load3DViewerContent,
    props: props,
    dialogComponentProps: {
      style: 'width: 80vw; height: 80vh;',
      maximizable: true,
      onClose: async () => {
        await useLoad3dService().handleViewerClose(props.node)
      }
    }
  })
}
</script>

<style scoped></style>
