<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { TypeFilter } from '../../lib/hub/browse-entry'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const type = defineModel<TypeFilter>({ required: true })

// An app is a workflow somebody wrapped in a form, so it browses as one and
// the badge on its card is what says which it is.
const TYPES: readonly { value: TypeFilter; label: TranslationKey }[] = [
  { value: 'all', label: 'workshop.v2.kind.all' },
  { value: 'workflow', label: 'workshop.v2.kind.workflows' },
  { value: 'model', label: 'workshop.v2.kind.models' }
]
</script>

<template>
  <div
    class="scrollbar-hide inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-transparency-white-t8 p-1 max-sm:gap-0"
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
          'inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:px-2.5',
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
    </button>
  </div>
</template>
