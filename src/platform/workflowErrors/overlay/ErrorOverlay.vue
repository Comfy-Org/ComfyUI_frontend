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
        :class="
          cn(
            'pointer-events-auto relative flex w-fit max-w-120 min-w-80 flex-col gap-2 overflow-hidden rounded-lg border border-l-4 bg-background p-3 shadow-md transition-colors duration-200 ease-in-out',
            hasError ? 'border-l-destructive' : 'border-l-warning'
          )
        "
      >
        <div class="flex w-full items-start gap-2 pr-8">
          <i
            aria-hidden="true"
            data-testid="error-overlay-icon"
            :class="
              cn(
                'mt-0.5 size-5',
                hasError
                  ? 'icon-[comfy--circle-alert-filled] text-destructive'
                  : 'icon-[comfy--triangle-alert-filled] text-warning'
              )
            "
          />
          <span class="sr-only">{{
            t(hasError ? 'g.error' : 'g.warning')
          }}</span>
          <span class="min-w-0 flex-1 truncate text-sm">
            {{ overlayTitle }}
          </span>
        </div>

        <div
          class="flex w-full items-start gap-2 pr-8"
          data-testid="error-overlay-messages"
        >
          <span class="size-5 shrink-0" aria-hidden="true" />
          <p
            class="m-0 line-clamp-3 min-w-0 flex-1 text-sm/snug wrap-break-word whitespace-pre-wrap text-muted-foreground"
          >
            {{ overlayMessage }}
          </p>
        </div>

        <ErrorOverlayDeploymentOffer v-if="hasMissingNodes" />

        <div class="flex w-full items-center justify-end gap-2 pt-2">
          <Button
            variant="textonly"
            size="sm"
            data-testid="error-overlay-see-errors"
            @click="emit('viewErrors', overlayGroupKeys)"
          >
            {{
              appMode
                ? t('linearMode.error.goto')
                : t('errorOverlay.viewDetails')
            }}
          </Button>
          <Button
            v-if="canAskAgent && askAgentContext"
            variant="secondary"
            size="sm"
            data-testid="error-overlay-ask-agent"
            @click="askAgent"
          >
            {{ t('errorOverlay.askAgent') }}
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
          <i class="icon-[lucide--x] block leading-none" />
        </Button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@comfyorg/design-system/button/Button'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useErrorOverlayState } from '@/platform/workflowErrors/overlay/useErrorOverlayState'
import ErrorOverlayDeploymentOffer from '@/platform/workspace/components/ErrorOverlayDeploymentOffer.vue'
import { useAskAgentPort } from '@/platform/workflowErrors/askAgentPort'

const { appMode = false } = defineProps<{ appMode?: boolean }>()

const emit = defineEmits<{ viewErrors: [groupKeys: readonly string[]] }>()

const { t } = useI18n()
const executionErrorStore = useExecutionErrorStore()
const { canAskAgent, askAgentAboutIssues } = useAskAgentPort()

const {
  hasError,
  hasMissingNodes,
  isVisible,
  overlayMessage,
  overlayTitle,
  overlayGroupKeys,
  askAgentContext
} = useErrorOverlayState()

function dismiss() {
  executionErrorStore.dismissErrorOverlay()
}

function askAgent() {
  const context = askAgentContext.value
  if (!context) return
  askAgentAboutIssues(context)
  executionErrorStore.dismissErrorOverlay()
}
</script>
