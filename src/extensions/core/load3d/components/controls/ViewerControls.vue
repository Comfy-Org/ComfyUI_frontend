<template>
  <div class="relative rounded-lg bg-background/30">
    <div class="flex flex-col gap-2">
      <Button
        :tooltip="t('load3d.openIn3DViewer')"
        tooltip-side="right"
        size="icon"
        variant="textonly"
        class="rounded-full"
        :aria-label="t('load3d.openIn3DViewer')"
        @click="openIn3DViewer"
      >
        <i class="icon-[lucide--expand] size-4.5 text-foreground" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Load3DViewerContent from '@/extensions/core/load3d/components/Load3dViewerContent.vue'
import Button from '@comfyorg/design-system/button/Button'
import { LOAD3D_VIEWER_DIALOG_PROPS } from '@/extensions/core/load3d/components/load3dViewerDialog'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useLoad3dService } from '@/extensions/core/load3d/services/load3dService'
import { useDialogStore } from '@/stores/dialogStore'

const { t } = useI18n()
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
      ...LOAD3D_VIEWER_DIALOG_PROPS,
      onClose: async () => {
        await useLoad3dService().handleViewerClose(props.node)
      }
    }
  })
}
</script>
