<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="-translate-y-3 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
  >
    <div v-if="isVisible" class="pointer-events-none flex w-full justify-end">
      <div
        role="alert"
        aria-live="assertive"
        data-testid="error-overlay"
        class="pointer-events-auto flex w-80 min-w-72 flex-col overflow-hidden rounded-lg border border-destructive-background bg-comfy-menu-bg shadow-interface transition-colors duration-200 ease-in-out"
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
        <div class="px-4 pb-3" data-testid="error-overlay-messages">
          <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
            <li
              v-for="(message, idx) in overlayMessages"
              :key="idx"
              class="flex min-w-0 items-baseline gap-2 text-sm/snug text-muted-foreground"
            >
              <span
                class="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground"
              />
              <span class="line-clamp-3 wrap-break-word whitespace-pre-wrap">{{
                message
              }}</span>
            </li>
          </ul>
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
            {{ appMode ? t('linearMode.error.goto') : seeErrorsLabel }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

import Button from '@/components/ui/button/Button.vue'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useErrorGroups } from '@/components/rightSidePanel/errors/useErrorGroups'

defineProps<{ appMode?: boolean }>()

const { t } = useI18n()
const executionErrorStore = useExecutionErrorStore()
const rightSidePanelStore = useRightSidePanelStore()
const canvasStore = useCanvasStore()

const { totalErrorCount, isErrorOverlayOpen } = storeToRefs(executionErrorStore)
const { allErrorGroups, missingModelGroups } = useErrorGroups(ref(''), t)

const singleErrorType = computed(() => {
  const types = new Set(allErrorGroups.value.map((g) => g.type))
  return types.size === 1 ? [...types][0] : null
})

function toFriendlyMessage(group: (typeof allErrorGroups.value)[number]) {
  if (group.type === 'missing_node') return t('errorOverlay.missingNodes')
  if (group.type === 'swap_nodes') return t('errorOverlay.swapNodes')
  if (group.type === 'missing_model') {
    const modelCount = missingModelGroups.value.reduce(
      (count, g) => count + g.models.length,
      0
    )
    return t('errorOverlay.missingModels', { count: modelCount }, modelCount)
  }
  return null
}

const overlayMessages = computed<string[]>(() => {
  const messages = new Set<string>()
  for (const group of allErrorGroups.value) {
    const friendly = toFriendlyMessage(group)
    if (friendly) {
      messages.add(friendly)
    } else if (group.type === 'execution') {
      for (const card of group.cards) {
        for (const err of card.errors) {
          messages.add(err.message)
        }
      }
    }
  }
  return Array.from(messages)
})

const seeErrorsLabel = computed(() => {
  const labelMap: Record<string, string> = {
    missing_node: t('errorOverlay.showMissingNodes'),
    missing_model: t('errorOverlay.showMissingModels'),
    swap_nodes: t('errorOverlay.showSwapNodes')
  }
  if (singleErrorType.value) {
    return labelMap[singleErrorType.value] ?? t('errorOverlay.seeErrors')
  }
  return t('errorOverlay.seeErrors')
})

const errorCountLabel = computed(() =>
  t(
    'errorOverlay.errorCount',
    { count: totalErrorCount.value },
    totalErrorCount.value
  )
)

const isVisible = computed(
  () => isErrorOverlayOpen.value && totalErrorCount.value > 0
)

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
