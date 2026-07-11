<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="-translate-y-3 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
  >
    <div v-if="isVisible" class="pointer-events-none flex w-full justify-end">
      <div
        role="status"
        data-testid="error-overlay"
        class="pointer-events-auto relative flex w-fit max-w-120 min-w-80 flex-col gap-2 overflow-hidden rounded-lg border border-l-4 border-border-default border-l-destructive-background bg-base-background p-3 shadow-interface transition-colors duration-200 ease-in-out"
      >
        <div class="flex w-full items-start gap-2 pr-8">
          <i
            class="mt-0.5 icon-[lucide--circle-x] size-4 shrink-0 text-destructive-background"
          />
          <span class="min-w-0 flex-1 truncate text-sm text-base-foreground">
            {{ overlayTitle }}
          </span>
        </div>

        <div
          class="flex w-full items-start gap-2 pr-8"
          data-testid="error-overlay-messages"
        >
          <span class="size-4 shrink-0" aria-hidden="true" />
          <p
            class="m-0 line-clamp-3 min-w-0 flex-1 text-sm/snug wrap-break-word whitespace-pre-wrap text-muted-foreground"
          >
            {{ overlayMessage }}
          </p>
        </div>

        <div class="flex w-full items-center justify-end pt-2">
          <Button
            variant="secondary"
            size="unset"
            class="min-h-8 rounded-lg px-3 py-2 text-xs font-normal"
            data-testid="error-overlay-see-errors"
            @click="viewErrorsInGraph"
          >
            {{
              appMode
                ? t('linearMode.error.goto')
                : t('errorOverlay.viewDetails')
            }}
          </Button>
        </div>

        <Button
          variant="muted-textonly"
          size="icon-sm"
          class="absolute top-2 right-2 size-6 rounded-sm"
          data-testid="error-overlay-dismiss"
          :aria-label="t('g.close')"
          @click="dismiss"
        >
          <i class="icon-[lucide--x] block size-4 leading-none" />
        </Button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useErrorOverlayState } from '@/components/error/useErrorOverlayState'
import { useViewErrorsInGraph } from '@/composables/useViewErrorsInGraph'

const { appMode = false } = defineProps<{ appMode?: boolean }>()

const { t } = useI18n()
const executionErrorStore = useExecutionErrorStore()
const { viewErrorsInGraph } = useViewErrorsInGraph()

const { isVisible, overlayMessage, overlayTitle } = useErrorOverlayState()

function dismiss() {
  executionErrorStore.dismissErrorOverlay()
}
</script>
