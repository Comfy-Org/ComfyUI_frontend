<template>
  <template v-if="isVisible">
    <Button
      v-if="!isNarrow"
      data-testid="error-resolution-back"
      variant="secondary"
      size="lg"
      class="fixed top-2 left-2 z-1000"
      @click="backToAppMode"
    >
      <i class="icon-[lucide--arrow-left] size-4" />
      {{ t('errorResolution.backToApp') }}
    </Button>
    <ErrorResolutionPanel @back="backToAppMode" />
  </template>
</template>

<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useErrorResolutionStore } from '@/stores/workspace/errorResolutionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const ErrorResolutionPanel = defineAsyncComponent(
  () => import('@/components/errorResolution/ErrorResolutionPanel.vue')
)

const { t } = useI18n()
const canvasStore = useCanvasStore()
const errorResolutionStore = useErrorResolutionStore()
const workspaceStore = useWorkspaceStore()
const isNarrow = useBreakpoints(breakpointsTailwind).smaller('md')

const isVisible = computed(
  () => errorResolutionStore.isActive && !canvasStore.linearMode
)

function backToAppMode() {
  errorResolutionStore.exit()
  workspaceStore.focusMode = false
  canvasStore.linearMode = true
}
</script>
