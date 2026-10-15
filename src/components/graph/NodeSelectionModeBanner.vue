<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import CanvasBanner from '@/components/graph/CanvasBanner.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDialogStore } from '@/stores/dialogStore'

const { t } = useI18n()
const canvasInteractions = useCanvasInteractions()
const canvasStore = useCanvasStore()
const dialogStore = useDialogStore()

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && dialogStore.dialogStack.length === 0)
    canvasStore.stopNodePicking()
})
</script>

<template>
  <div
    class="pointer-events-none absolute top-4 left-1/2 z-40 -translate-x-1/2"
  >
    <Transition
      enter-active-class="transition-[transform,opacity] delay-300 duration-150 ease-out"
      leave-active-class="transition-[transform,opacity] duration-150 ease-out"
      enter-from-class="-translate-y-full opacity-0"
      leave-to-class="-translate-y-full opacity-0"
    >
      <CanvasBanner
        v-if="canvasStore.isPickingNodes"
        data-testid="node-selection-mode-banner"
        accent="border-l-primary-background"
        class="max-w-lg"
        @wheel="canvasInteractions.forwardEventToCanvas"
      >
        <template #title>{{ t('agent.nodeSelection.bannerTitle') }}</template>
        <template #description>
          {{ t('agent.nodeSelection.bannerSubtitle') }}
        </template>
        <template #actions>
          <Button
            variant="secondary"
            size="sm"
            @click="canvasStore.stopNodePicking()"
          >
            {{ t('agent.nodeSelection.exit') }}
          </Button>
        </template>
      </CanvasBanner>
    </Transition>
  </div>
</template>
