<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="-translate-y-3 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
  >
    <div v-if="isVisible" class="pointer-events-none flex w-full justify-end">
      <div
        role="status"
        aria-live="polite"
        data-testid="error-overlay"
        class="pointer-events-auto flex w-fit max-w-120 min-w-80 flex-col overflow-hidden rounded-lg border border-destructive-background bg-comfy-menu-bg shadow-interface transition-colors duration-200 ease-in-out"
      >
        <!-- Header -->
        <div class="flex h-12 items-center gap-2 px-4">
          <span class="flex-1 text-sm font-bold text-destructive-background">
            {{ overlayTitle }}
          </span>
          <Button
            variant="muted-textonly"
            size="icon-sm"
            :aria-label="t('g.close')"
            @click="dismiss"
          >
            <i class="icon-[lucide--x] block size-5 leading-none" />
          </Button>
        </div>

        <!-- Body -->
        <div class="px-4 pb-3" data-testid="error-overlay-messages">
          <p
            class="m-0 line-clamp-3 text-sm/snug wrap-break-word whitespace-pre-wrap text-muted-foreground"
          >
            {{ overlayMessage }}
          </p>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-4 px-4 py-3">
          <Button
            variant="muted-textonly"
            size="unset"
            data-testid="error-overlay-dismiss"
            @click="dismiss"
          >
            {{ t('g.dismiss') }}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            data-testid="error-overlay-see-errors"
            @click="seeErrors"
          >
            {{
              appMode
                ? t('linearMode.error.goto')
                : t('errorOverlay.viewDetails')
            }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useErrorOverlayState } from '@/components/error/useErrorOverlayState'

const { appMode = false } = defineProps<{ appMode?: boolean }>()

const { t } = useI18n()
const executionErrorStore = useExecutionErrorStore()
const rightSidePanelStore = useRightSidePanelStore()
const canvasStore = useCanvasStore()

const { isVisible, overlayMessage, overlayTitle } = useErrorOverlayState()

function dismiss() {
  executionErrorStore.dismissErrorOverlay()
}

function seeErrors() {
  canvasStore.linearMode = false
  if (canvasStore.canvas) {
    canvasStore.canvas.deselectAll()
    canvasStore.updateSelectedItems()
  }

  rightSidePanelStore.openPanel('errors')
  executionErrorStore.dismissErrorOverlay()
}
</script>
