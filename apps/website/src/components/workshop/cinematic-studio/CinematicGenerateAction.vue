<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { ShotEstimate } from '../../../lib/workshop/cinematic-studio/estimate'
import {
  formatCreditRange,
  takesWithin
} from '../../../lib/workshop/cinematic-studio/estimate'
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicCostLabel from './CinematicCostLabel.vue'
import CinematicGateButton from './CinematicGateButton.vue'

const {
  gate,
  workspaceName,
  rendering,
  canGenerate,
  blockedNote,
  estimate,
  credits,
  wide = false,
  locale = 'en'
} = defineProps<{
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
  canGenerate: boolean
  blockedNote?: string
  estimate?: ShotEstimate
  credits?: number
  wide?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  generate: []
  cancel: []
  reduceTakes: [takes: number]
}>()

const creditGate = computed(
  () => gate === 'noCredits' || gate === 'memberNoCredits'
)

function shortfallNote(shot: ShotEstimate, balance: number): string {
  const key =
    shot.takes === 1 ? 'cinematic.credits.shortOne' : 'cinematic.credits.short'
  return tc(key, locale)
    .replace('{takes}', String(shot.takes))
    .replace('{credits}', formatCreditRange(shot.total, locale))
    .replace('{balance}', balance.toLocaleString(locale))
}

const shortfall = computed(() => {
  if (!creditGate.value || !estimate || credits === undefined) return undefined
  return {
    note: shortfallNote(estimate, credits),
    fits: Math.min(takesWithin(credits, estimate.perTake), estimate.takes - 1)
  }
})

const GATE_NOTES: Partial<
  Record<
    StudioGate,
    'workshop.error.noCreditsCloud' | 'workshop.error.memberNoCredits'
  >
> = {
  noCredits: 'workshop.error.noCreditsCloud',
  memberNoCredits: 'workshop.error.memberNoCredits'
}

const note = computed(() => {
  if (shortfall.value) return shortfall.value.note
  if (gate === 'unavailable') return tc('cinematic.output.unavailable', locale)
  const key = GATE_NOTES[gate]
  return key
    ? t(key, locale).replace('{workspace}', () => workspaceName ?? '')
    : undefined
})

interface Note {
  readonly text: string
  readonly testId?: string
  readonly role?: 'status'
  readonly class: string
}

const notes = computed<readonly Note[]>(() => {
  const gateNote: Note | undefined = shortfall.value
    ? {
        text: shortfall.value.note,
        testId: 'cinematic-credit-note',
        role: 'status',
        class: cn(
          'text-xs text-primary-warm-white',
          !wide && 'max-w-72 text-right'
        )
      }
    : wide && note.value
      ? { text: note.value, class: 'text-xs text-content-secondary' }
      : undefined
  const blocked: Note | undefined = blockedNote
    ? {
        text: blockedNote,
        role: 'status',
        class: cn(
          'text-xs text-content-secondary',
          !wide && 'max-w-64 text-right'
        )
      }
    : undefined
  return [gateNote, blocked].filter((entry) => entry !== undefined)
})

const reduceTo = computed(() => {
  const fits = shortfall.value?.fits ?? 0
  return fits >= 1 ? fits : undefined
})
const reduceLabel = computed(() =>
  reduceTo.value === 1
    ? tc('cinematic.credits.reduceOne', locale)
    : tc('cinematic.credits.reduce', locale).replace(
        '{takes}',
        String(reduceTo.value)
      )
)
const showCost = computed(
  () => !rendering && gate !== 'unavailable' && gate !== 'pending'
)
const layout = computed(() =>
  wide
    ? {
        root: 'flex flex-col gap-2.5',
        row: 'flex flex-col items-stretch gap-2',
        button: 'w-full rounded-full px-5'
      }
    : {
        root: 'flex shrink-0 flex-col items-end gap-2.5',
        row: 'flex flex-wrap items-center justify-end gap-3',
        button: 'shrink-0 rounded-full px-6'
      }
)
</script>

<template>
  <div :class="layout.root">
    <p
      v-for="entry in notes"
      :key="entry.text"
      :role="entry.role"
      :data-testid="entry.testId"
      :class="entry.class"
    >
      {{ entry.text }}
    </p>
    <div :class="layout.row">
      <CinematicCostLabel v-if="showCost" :estimate :wide :locale />
      <Button
        v-if="reduceTo"
        variant="outline"
        :class="layout.button"
        @click="emit('reduceTakes', reduceTo)"
      >
        {{ reduceLabel }}
      </Button>
      <CinematicGateButton
        :gate
        :rendering
        :can-generate="canGenerate"
        :note
        :tooltip="!wide && !!note && !shortfall"
        :wide
        :locale
        @generate="emit('generate')"
        @cancel="emit('cancel')"
      />
    </div>
  </div>
</template>
