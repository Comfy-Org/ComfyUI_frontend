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
        v-if="agentNodeSelectionStore.isBannerVisible"
        data-testid="node-selection-mode-banner"
        class="pointer-events-auto flex max-w-lg items-center gap-8 rounded-lg border border-l-4 border-interface-stroke border-l-primary-background bg-interface-panel-surface p-4 shadow-interface"
        @wheel="canvasInteractions.forwardEventToCanvas"
      >
        <div class="flex flex-col">
          <span class="text-sm font-medium text-base-foreground">
            {{ t('agent.nodeSelection.bannerTitle') }}
          </span>
          <span class="text-sm text-muted-foreground">
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
