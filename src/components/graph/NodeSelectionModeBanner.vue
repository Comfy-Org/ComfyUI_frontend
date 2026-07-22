<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'

const { t } = useI18n()
const agentNodeSelectionStore = useAgentNodeSelectionStore()
const canvasInteractions = useCanvasInteractions()
</script>

<template>
  <div
    class="pointer-events-none absolute top-1 left-1/2 z-40 -translate-x-1/2"
  >
    <Transition name="slide-down">
      <div
        v-if="agentNodeSelectionStore.isActive"
        data-testid="node-selection-mode-banner"
        class="pointer-events-auto flex items-center gap-4 rounded-lg border border-l-4 border-interface-stroke border-l-node-component-executing bg-interface-panel-surface px-4 py-2 shadow-interface"
        @wheel="canvasInteractions.forwardEventToCanvas"
      >
        <div class="flex flex-col">
          <span class="text-sm font-medium text-base-foreground">
            {{ t('agent.nodeSelection.bannerTitle') }}
          </span>
          <span class="text-xs text-muted-foreground">
            {{ t('agent.nodeSelection.bannerSubtitle') }}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          @click="agentNodeSelectionStore.exit()"
        >
          {{ t('agent.nodeSelection.exit') }}
        </Button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    transform 150ms ease-out,
    opacity 150ms ease-out;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
