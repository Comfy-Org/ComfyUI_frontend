<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { TypeFilter } from '../../lib/hub/browse-entry'

const { counts, locale = 'en' } = defineProps<{
  /** What choosing each type would return, not how many exist in the abstract. */
  counts: Readonly<Record<TypeFilter, number>>
  locale?: Locale
}>()

const type = defineModel<TypeFilter>({ required: true })

const TYPES: readonly { value: TypeFilter; label: TranslationKey }[] = [
  { value: 'all', label: 'workshop.v2.kind.all' },
  { value: 'workflow', label: 'workshop.v2.kind.workflows' },
  { value: 'app', label: 'workshop.v2.kind.apps' },
  { value: 'model', label: 'workshop.v2.kind.models' }
]
</script>

<template>
  <div
    class="inline-flex items-center gap-1 rounded-2xl bg-transparency-white-t8 p-1 max-sm:w-full"
    role="group"
    :aria-label="t('workshop.v2.kind.all', locale)"
    data-testid="catalogue-type-facet"
  >
    <button
      v-for="option in TYPES"
      :key="option.value"
      type="button"
      :class="
        cn(
          'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:flex-1',
          type === option.value
            ? 'bg-primary-warm-white text-page'
            : 'text-content-secondary hover:text-content-bright'
        )
      "
      :aria-pressed="type === option.value"
      :data-active="type === option.value"
      :data-testid="`catalogue-type-${option.value}`"
      @click="type = option.value"
    >
      {{ t(option.label, locale) }}
      <span class="text-2xs tabular-nums opacity-70">
        {{ counts[option.value] }}
      </span>
    </button>
  </div>
</template>
