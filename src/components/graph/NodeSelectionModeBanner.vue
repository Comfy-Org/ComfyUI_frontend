<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import CanvasBanner from '@/components/graph/CanvasBanner.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

const { t } = useI18n()
const canvasInteractions = useCanvasInteractions()
const agentNodeSelectionStore = useAgentNodeSelectionStore()
</script>

<template>
  <div
    class="pointer-events-none absolute top-4 left-1/2 z-40 -translate-x-1/2"
  >
    <Transition
      enter-active-class="transition-[transform,opacity] duration-150 ease-out"
      leave-active-class="transition-[transform,opacity] duration-150 ease-out"
      enter-from-class="-translate-y-full opacity-0"
      leave-to-class="-translate-y-full opacity-0"
    >
      <CanvasBanner
        v-if="agentNodeSelectionStore.isBannerVisible"
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
            @click="agentNodeSelectionStore.exit()"
          >
            {{ t('agent.nodeSelection.exit') }}
          </Button>
        </template>
      </CanvasBanner>
    </Transition>
  </div>
</template>
