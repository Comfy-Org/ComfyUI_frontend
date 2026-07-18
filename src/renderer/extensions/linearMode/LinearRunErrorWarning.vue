<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useErrorOverlayState } from '@/components/error/useErrorOverlayState'
import { useViewErrorsInGraph } from '@/composables/useViewErrorsInGraph'
import { LINEAR_RUN_ERROR_WARNING_DESCRIPTION_ID } from '@/renderer/extensions/linearMode/linearRunErrorWarningIds'

const { t } = useI18n()
const { viewErrorsInGraph } = useViewErrorsInGraph()
const { overlayMessage, overlayTitle } = useErrorOverlayState()
</script>

<template>
  <div
    role="status"
    data-testid="linear-validation-warning"
    class="mb-3 flex w-full flex-col gap-2 overflow-hidden rounded-lg border border-l-4 border-border-default border-l-destructive-background bg-base-background p-3 shadow-interface transition-colors duration-200 ease-in-out"
  >
    <div
      :id="LINEAR_RUN_ERROR_WARNING_DESCRIPTION_ID"
      data-testid="linear-validation-warning-description"
      class="flex flex-col gap-2"
    >
      <div class="flex w-full items-start gap-2">
        <i
          aria-hidden="true"
          class="mt-0.5 icon-[lucide--circle-x] size-4 shrink-0 text-destructive-background"
        />
        <span
          class="min-w-0 flex-1 truncate text-sm text-base-foreground"
          :title="overlayTitle"
        >
          {{ overlayTitle }}
        </span>
      </div>

      <div
        class="flex w-full items-start gap-2"
        data-testid="linear-validation-warning-message"
      >
        <span class="size-4 shrink-0" aria-hidden="true" />
        <p
          class="m-0 line-clamp-3 min-w-0 flex-1 text-sm/snug wrap-break-word whitespace-pre-wrap text-muted-foreground"
        >
          {{ overlayMessage }}
        </p>
      </div>
    </div>

    <div class="flex w-full items-center justify-end pt-2">
      <Button
        variant="secondary"
        size="unset"
        class="min-h-8 rounded-lg px-3 py-2 text-xs font-normal"
        data-testid="linear-view-errors"
        @click="viewErrorsInGraph"
      >
        {{ t('linearMode.fixErrors') }}
      </Button>
    </div>
  </div>
</template>
