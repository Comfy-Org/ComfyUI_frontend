<script setup lang="ts">
import { refThrottled } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import Button from '@/components/ui/button/Button.vue'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import GeneratingCard from '@/renderer/extensions/linearMode/GeneratingCard.vue'
import type { InProgressItem } from '@/renderer/extensions/linearMode/linearModeTypes'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { getMediaType } from '@/renderer/extensions/linearMode/mediaTypes'
import { useExecutionStatus } from '@/renderer/extensions/linearMode/useExecutionStatus'

defineEmits<{ stop: [] }>()

const { t } = useI18n()
const { executionStatusMessage } = useExecutionStatus()
const { totalPercent } = useQueueProgress()
const { generatingCards } = storeToRefs(useLinearOutputStore())
const workflowStore = useWorkflowStore()

const statusMessage = computed(
  () => executionStatusMessage.value ?? t('linearMode.generating')
)
// Throttle status text so it doesn't flicker as nodes execute in quick succession.
const displayStatus = refThrottled(statusMessage, 1000)

// A card's still image (latent preview or image output), if it has one.
function imageSrcOf(card: InProgressItem): string | undefined {
  if (card.state === 'latent') return card.latentPreviewUrl
  if (
    card.state === 'image' &&
    card.output &&
    getMediaType(card.output) === 'images'
  )
    return card.output.url
  return undefined
}

// The store owns which cards are in the fan, their order, and the limit. This
// component only adds a presentation gate: an image card is shown once its src
// has decoded off-DOM (so it never paints half-formed) and keeps its last
// decoded frame while a newer latent preview decodes. Non-image cards (video /
// other) are shown immediately.
const decodedSrc = reactive(new Map<string, string>()) // card id -> shown src
const ready = reactive(new Set<string>()) // card ids cleared to paint
const decoding = new Set<string>() // in-flight `${id}:${src}` decode keys

// Decode promises can resolve after the screen unmounts (run stopped, workflow
// switched); guard so they stop mutating then.
let active = true
onUnmounted(() => (active = false))

function reset() {
  decodedSrc.clear()
  ready.clear()
  decoding.clear()
}

// Drop a run's cards when switching to a different workflow.
watch(() => workflowStore.activeWorkflow?.path, reset)

watch(
  generatingCards,
  (cards) => {
    const liveIds = new Set(cards.map((c) => c.id))
    for (const id of decodedSrc.keys())
      if (!liveIds.has(id)) decodedSrc.delete(id)
    for (const id of ready) if (!liveIds.has(id)) ready.delete(id)

    for (const card of cards) {
      const src = imageSrcOf(card)
      if (!src) {
        if (card.state === 'image' && card.output) ready.add(card.id)
        continue
      }
      if (decodedSrc.get(card.id) === src) continue // already showing this frame
      const key = `${card.id}:${src}`
      if (decoding.has(key)) continue // decode already in flight for this frame
      decoding.add(key)
      const img = new Image()
      img.src = src
      const reveal = () => {
        decoding.delete(key)
        if (!active) return
        const current = generatingCards.value.find((c) => c.id === card.id)
        if (!current) return
        // Show this frame if it is still the latest, or if nothing has decoded
        // yet (so the first frame appears even while a newer one decodes).
        if (imageSrcOf(current) === src || !decodedSrc.has(card.id)) {
          decodedSrc.set(card.id, src)
          ready.add(card.id)
        }
      }
      void img.decode().then(reveal).catch(reveal)
    }
  },
  { immediate: true }
)

// generatingCards is newest-first; render the ready cards oldest-first so the
// newest paints last (on top).
const fanCards = computed(() => {
  const cards = generatingCards.value.filter((c) => ready.has(c.id))
  const total = cards.length
  return cards
    .map((card, depth) => ({
      card,
      depth,
      total,
      src: decodedSrc.get(card.id)
    }))
    .reverse()
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
              v-for="{ card, depth, total, src } in fanCards"
              :key="card.id"
              :card
              :depth
              :total
              :src
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
