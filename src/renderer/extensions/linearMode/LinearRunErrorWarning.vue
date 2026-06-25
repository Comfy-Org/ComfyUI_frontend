<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useErrorOverlayState } from '@/components/error/useErrorOverlayState'
import { useViewErrorsInGraph } from '@/composables/useViewErrorsInGraph'

const { t } = useI18n()
const { viewErrorsInGraph } = useViewErrorsInGraph()
const { overlayMessage, overlayTitle } = useErrorOverlayState()
</script>

<template>
  <div
    id="linear-run-error-warning"
    role="status"
    data-testid="linear-validation-warning"
    class="mb-3 flex w-full flex-col gap-2 overflow-hidden rounded-lg border border-l-4 border-border-default border-l-destructive-background bg-base-background p-3 shadow-interface transition-colors duration-200 ease-in-out"
  >
    <div class="flex w-full items-start gap-2">
      <i
        aria-hidden="true"
        class="mt-0.5 icon-[lucide--circle-x] size-4 shrink-0 text-destructive-background"
      />
      <span class="min-w-0 flex-1 truncate text-sm text-base-foreground">
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

    <div class="flex w-full items-center justify-end pt-2">
      <Button
        variant="secondary"
        size="unset"
        class="min-h-8 rounded-lg px-3 py-2 text-xs font-normal"
        data-testid="linear-view-errors"
        @click="viewErrorsInGraph"
      >
        {{ t('linearMode.error.goto') }}
      </Button>
    </div>
  </div>
</template>
