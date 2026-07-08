<script setup lang="ts">
import { refThrottled } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import Button from '@/components/ui/button/Button.vue'
import GeneratingCard from '@/renderer/extensions/linearMode/GeneratingCard.vue'
import type { InProgressItem } from '@/renderer/extensions/linearMode/linearModeTypes'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { useExecutionStatus } from '@/renderer/extensions/linearMode/useExecutionStatus'

defineEmits<{ stop: [] }>()

const { t } = useI18n()
const { executionStatusMessage } = useExecutionStatus()
const { totalPercent } = useQueueProgress()
const { generatingCards } = storeToRefs(useLinearOutputStore())

const statusMessage = computed(
  () => executionStatusMessage.value ?? t('linearMode.generating')
)
// Throttle status text so it doesn't flicker as nodes execute in quick succession.
const displayStatus = refThrottled(statusMessage, 1000)

// Only cards with something to show belong in the fan; skeletons and latents
// without a preview are skipped. Each card fades its own image in on load.
function hasFanContent(card: InProgressItem): boolean {
  if (card.state === 'image') return card.output != null
  if (card.state === 'latent') return card.latentPreviewUrl != null
  return false
}

// generatingCards is newest-first; render oldest-first so the newest paints
// last (on top).
const fanCards = computed(() => {
  const cards = generatingCards.value.filter(hasFanContent)
  const total = cards.length
  return cards.map((card, depth) => ({ card, depth, total })).reverse()
})
</script>
<template>
  <div class="flex size-full min-h-0 items-center justify-center px-6">
    <div
      class="@container-size relative flex size-full items-center justify-center"
    >
      <div
        class="relative z-10 flex w-full max-w-[min(100%,440px)] flex-col items-center gap-8 px-4"
      >
        <div
          class="relative flex h-[min(50cqh,320px)] w-full shrink-0 items-center justify-center overflow-visible"
        >
          <div
            class="pointer-events-none absolute top-1/2 left-1/2 size-[min(150cqw,150cqh,760px)] -translate-1/2"
          >
            <span class="gen-glow" />
          </div>
          <TransitionGroup
            tag="div"
            name="genfan"
            class="pointer-events-none absolute inset-0"
          >
            <GeneratingCard
              v-for="{ card, depth, total } in fanCards"
              :key="card.id"
              :card
              :depth
              :total
            />
          </TransitionGroup>
        </div>

        <div
          class="relative flex w-full max-w-[min(100%,280px)] shrink-0 flex-col items-center gap-7"
        >
          <span
            role="status"
            aria-live="polite"
            class="min-h-[18px] text-center text-[13px] leading-tight text-muted-foreground"
          >
            {{ displayStatus }}
          </span>
          <div
            role="progressbar"
            :aria-valuenow="Math.round(totalPercent)"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="t('linearMode.generating')"
            class="relative h-0.5 w-full overflow-hidden rounded-full bg-secondary-background"
          >
            <div
              data-testid="generating-progress"
              class="h-full rounded-full bg-interface-panel-job-progress-primary transition-[width] duration-150 ease-linear"
              :style="{ width: `${totalPercent}%` }"
            />
          </div>
          <Button
            variant="destructive"
            size="md"
            data-testid="linear-cancel-run"
            @click="$emit('stop')"
          >
            {{ t('linearMode.stopGeneration') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
