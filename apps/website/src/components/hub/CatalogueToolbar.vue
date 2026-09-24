<script setup lang="ts">
import { X } from '@lucide/vue'
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'
import type { TypeFilter } from '../../lib/hub/browse-entry'

const {
  narrowedBy,
  outcomeLabel,
  locale = 'en'
} = defineProps<{
  narrowedBy: TypeFilter | undefined
  /** The curated row a reader asked to see in full, while it is narrowing. */
  outcomeLabel: string | undefined
  locale?: Locale
}>()

const emit = defineEmits<{ clear: []; clearOutcome: [] }>()

const usesModel = defineModel<string>('usesModel', { required: true })

// A row of chips with no chip in it is a clear button for nothing, so the row
// answers to what it is holding rather than to whether anything was narrowed.
const chips = computed(() =>
  Boolean(outcomeLabel || usesModel.value || narrowedBy)
)

const chipClass =
  'inline-flex h-8 items-center gap-2 rounded-full bg-transparency-white-t8 px-3 text-xs text-content'

const narrowedLabel = () =>
  tHub('workshop.v2.sort.narrowed', locale).replace(
    '{type}',
    tHub(
      narrowedBy === 'model'
        ? 'workshop.v2.kind.models'
        : 'workshop.v2.kind.workflows',
      locale
    ).toLowerCase()
  )
</script>

<template>
  <div v-if="chips" class="mb-6">
    <div
      class="flex flex-wrap items-center gap-2"
      data-testid="catalogue-chips"
    >
      <span v-if="outcomeLabel" :class="chipClass">
        {{ outcomeLabel }}
        <button
          type="button"
          class="cursor-pointer text-content-muted hover:text-content-bright"
          :aria-label="tHub('workshop.v2.clear', locale)"
          data-testid="catalogue-chip-outcome"
          @click="emit('clearOutcome')"
        >
          <X class="size-3" />
        </button>
      </span>
      <span v-if="usesModel" :class="chipClass">
        {{
          tHub('workshop.v2.card.runsOn', locale).replace('{model}', usesModel)
        }}
        <button
          type="button"
          class="cursor-pointer text-content-muted hover:text-content-bright"
          :aria-label="tHub('workshop.v2.clear', locale)"
          @click="usesModel = ''"
        >
          <X class="size-3" />
        </button>
      </span>
      <!-- An order only one kind can honour narrows the type rather than
        vanishing from the menu, and this chip is the explanation. -->
      <span v-if="narrowedBy" :class="chipClass">{{ narrowedLabel() }}</span>
      <button
        type="button"
        class="cursor-pointer text-xs text-content-muted underline underline-offset-4 hover:text-content-bright"
        @click="emit('clear')"
      >
        {{ tHub('workshop.v2.clear', locale) }}
      </button>
    </div>
  </div>
</template>
