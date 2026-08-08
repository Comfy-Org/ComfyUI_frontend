<script setup lang="ts">
import { onKeyStroke, useWindowSize } from '@vueuse/core'
import { ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { CoachStep } from '../../composables/agent/useOnboarding'
import { useOnboarding } from '../../composables/agent/useOnboarding'

const { step, storageKey } = defineProps<{
  step: CoachStep
  storageKey?: string
}>()

const { t } = useI18n()
const { active, finish } = useOnboarding(storageKey)

onKeyStroke('Escape', () => {
  if (active.value) finish()
})

const { width, height } = useWindowSize()
const CARD_W = 256
const CARD_H = 160
const MARGIN = 8

const cardStyle = ref<Record<string, string> | null>(null)

watchEffect(
  () => {
    cardStyle.value = null
    if (!active.value) return
    const target = document.querySelector(step.target)
    if (!target) return
    const rect = target.getBoundingClientRect()
    const left = Math.min(
      Math.max(MARGIN, rect.left),
      Math.max(MARGIN, width.value - CARD_W - MARGIN)
    )
    const top = Math.min(
      Math.max(MARGIN, rect.bottom + MARGIN),
      Math.max(MARGIN, height.value - CARD_H - MARGIN)
    )
    cardStyle.value = { top: `${top}px`, left: `${left}px` }
  },
  { flush: 'post' }
)
</script>

<template>
  <div
    v-if="active && cardStyle"
    role="dialog"
    aria-modal="true"
    :aria-label="step.title"
    class="fixed inset-0 z-50"
  >
    <div class="absolute inset-0 bg-black/40" />
    <div
      :style="cardStyle"
      class="rounded-agent border-agent-border bg-agent-surface-raised text-agent-fg absolute w-64 border p-3 shadow-xl"
    >
      <p class="text-sm font-semibold">{{ step.title }}</p>
      <p class="text-agent-fg-muted mt-1 text-xs">{{ step.body }}</p>
      <div class="mt-3 flex justify-end gap-2">
        <Button
          variant="muted-textonly"
          size="md"
          class="hover:text-agent-fg focus-visible:ring-agent-accent rounded-xl px-3 text-sm focus-visible:ring-2"
          @click="finish"
          >{{ t('agent.skip') }}</Button
        >
        <Button
          variant="primary"
          size="md"
          class="text-agent-accent-fg hover:bg-agent-accent/90 focus-visible:ring-agent-accent rounded-xl px-3 text-sm focus-visible:ring-2"
          @click="finish"
        >
          {{ t('agent.gotIt') }}
        </Button>
      </div>
    </div>
  </div>
</template>
