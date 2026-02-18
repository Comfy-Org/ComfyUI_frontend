<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="-translate-y-3 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
  >
    <div
      v-if="isVisible"
      :class="cn('flex justify-end w-full pointer-events-none')"
    >
      <div
        class="pointer-events-auto flex w-80 min-w-72 flex-col overflow-hidden rounded-lg border border-interface-stroke bg-comfy-menu-bg shadow-interface transition-colors duration-200 ease-in-out"
      >
        <!-- Header -->
        <div class="flex h-12 items-center gap-2 px-4">
          <span class="flex-1 text-sm font-bold text-destructive-background">
            {{ errorCountLabel }}
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
        <div class="px-4 pb-3">
          <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
            <li
              v-for="(entry, idx) in groupedErrors"
              :key="idx"
              class="flex items-baseline gap-2 text-sm leading-snug text-muted-foreground"
            >
              <span
                class="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground"
              />
              <span>{{ entry.message }}</span>
            </li>
          </ul>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-4 px-4 py-3">
          <Button variant="muted-textonly" size="unset" @click="dismiss">
            {{ t('g.dismiss') }}
          </Button>
          <Button variant="secondary" size="lg" @click="seeErrors">
            {{ t('errorOverlay.seeErrors') }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { NodeError } from '@/schemas/apiSchema'
import { useExecutionStore } from '@/stores/executionStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { cn } from '@/utils/tailwindUtil'

interface ErrorEntry {
  message: string
}

const { t } = useI18n()
const executionStore = useExecutionStore()
const rightSidePanelStore = useRightSidePanelStore()
const canvasStore = useCanvasStore()

const groupedErrors = computed<ErrorEntry[]>(() => {
  const messages = new Set<string>()

  if (executionStore.lastPromptError) {
    messages.add(executionStore.lastPromptError.message)
  }

  if (executionStore.lastNodeErrors) {
    for (const nodeError of Object.values(
      executionStore.lastNodeErrors
    ) as NodeError[]) {
      for (const err of nodeError.errors) {
        messages.add(err.message)
      }
    }
  }

  if (executionStore.lastExecutionError) {
    const e = executionStore.lastExecutionError
    messages.add(`${e.exception_type}: ${e.exception_message}`)
  }

  return Array.from(messages).map((message) => ({ message }))
})

const totalErrorCount = computed(() => executionStore.totalErrorCount)

const errorCountLabel = computed(() =>
  t(
    'errorOverlay.errorCount',
    { count: totalErrorCount.value },
    totalErrorCount.value
  )
)

const isVisible = computed(
  () => executionStore.isErrorOverlayOpen && totalErrorCount.value > 0
)

function dismiss() {
  executionStore.dismissErrorOverlay()
}

function seeErrors() {
  if (canvasStore.canvas) {
    canvasStore.canvas.deselectAll()
    canvasStore.updateSelectedItems()
  }

  rightSidePanelStore.openPanel('errors')
  executionStore.dismissErrorOverlay()
}
</script>
