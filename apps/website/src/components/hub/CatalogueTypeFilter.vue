<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { t } from '../../i18n/hub'
import type { TypeFilter } from '../../lib/hub/browse-entry'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const type = defineModel<TypeFilter>({ required: true })

const TABS: readonly { value: TypeFilter; label: HubKey }[] = [
  { value: 'model', label: 'workshop.v2.kind.models' },
  { value: 'workflow', label: 'workshop.v2.kind.workflows' }
]

// The two tabs share one moving marker rather than each painting its own
// background, so the change reads as the same object moving across.
const onSecond = computed(() => type.value === TABS[1].value)
</script>

<template>
  <div
    class="relative grid grid-cols-2 rounded-2xl bg-transparency-white-t8 p-1"
    role="group"
    :aria-label="t('workshop.v2.kind.label', locale)"
    data-testid="catalogue-type-facet"
  >
    <div class="pointer-events-none absolute inset-1 grid grid-cols-2">
      <div
        :class="
          cn(
            'rounded-xl bg-primary-warm-white transition-transform duration-300 ease-out motion-reduce:transition-none',
            onSecond && 'translate-x-full'
          )
        "
      />
    </div>

    <button
      v-for="option in TABS"
      :key="option.value"
      type="button"
      :class="
        cn(
          'relative inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-6 text-sm font-semibold whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:px-3',
          type === option.value
            ? 'text-page'
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
