<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

const { t } = useI18n()
const canvasInteractions = useCanvasInteractions()
const agentNodeSelectionStore = useAgentNodeSelectionStore()
</script>

<template>
  <div
    class="pointer-events-none absolute top-1 left-1/2 z-40 -translate-x-1/2"
  >
    <Transition
      enter-active-class="transition-[transform,opacity] duration-150 ease-out"
      leave-active-class="transition-[transform,opacity] duration-150 ease-out"
      enter-from-class="-translate-y-full opacity-0"
      leave-to-class="-translate-y-full opacity-0"
    >
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
