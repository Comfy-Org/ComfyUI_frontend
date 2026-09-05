<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '../../config/workshop'
import { formatRuns } from '../../config/workshop'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  models,
  query,
  providers,
  capabilities,
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  query: string
  providers: readonly string[]
  capabilities: readonly string[]
  locale?: Locale
}>()

const emit = defineEmits<{
  pick: [model: WorkshopModel]
  toggleProvider: [provider: string]
  toggleCapability: [capability: string]
}>()

const POPULAR = 4
const CHIPS = 6

const needle = computed(() => query.trim().toLowerCase())

const matching = computed(() =>
  needle.value === ''
    ? models
    : models.filter(
        (model) =>
          model.name.toLowerCase().includes(needle.value) ||
          (model.provider ?? '').toLowerCase().includes(needle.value)
      )
)

const popular = computed(() =>
  [...matching.value].sort((a, b) => b.runs - a.runs).slice(0, POPULAR)
)

// A provider or capability is worth offering only while it still leads
// somewhere: the chips narrow what the search already found.
const chipsFrom = (
  values: (model: WorkshopModel) => readonly string[],
  chosen: readonly string[]
) => {
  const counts = new Map<string, number>()
  for (const model of matching.value)
    for (const value of values(model))
      counts.set(value, (counts.get(value) ?? 0) + 1)
  const ranked = [...counts].sort(
    ([a, left], [b, right]) => right - left || a.localeCompare(b)
  )
  return {
    chips: ranked.slice(0, CHIPS).map(([value, count]) => ({
      value,
      count,
      selected: chosen.includes(value)
    })),
    more: Math.max(ranked.length - CHIPS, 0)
  }
}

const providerChips = computed(() =>
  chipsFrom((model) => (model.provider ? [model.provider] : []), providers)
)
const capabilityChips = computed(() =>
  chipsFrom((model) => model.capabilities, capabilities)
)

const chipClass = (selected: boolean) =>
  cn(
    'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-2xl border px-3 text-xs transition-colors',
    selected
      ? 'border-primary-comfy-yellow text-primary-comfy-yellow'
      : 'hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow border-transparency-white-t20 text-primary-comfy-canvas'
  )
</script>

<template>
  <div
    class="bg-page absolute inset-x-0 top-full z-30 mt-2 flex flex-col gap-5 rounded-2xl border border-transparency-white-t20 p-4 shadow-lg"
    data-testid="workshop-search-panel"
  >
    <section v-if="popular.length" class="flex flex-col gap-2">
      <p
        class="text-[11px] font-bold tracking-wider text-primary-warm-gray uppercase"
      >
        {{ t('workshop.search.popular', locale) }}
        <span class="tabular-nums opacity-60">({{ matching.length }})</span>
      </p>
      <button
        v-for="model in popular"
        :key="model.slug"
        type="button"
        class="hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4 flex cursor-pointer items-center gap-3 rounded-xl p-2 text-left outline-none"
        data-testid="workshop-search-model"
        @mousedown.prevent="emit('pick', model)"
      >
        <img
          v-if="model.thumbnailUrl"
          :src="model.thumbnailUrl"
          alt=""
          class="size-10 shrink-0 rounded-lg object-cover"
          loading="lazy"
          decoding="async"
        />
        <span
          v-else
          class="grid size-10 shrink-0 place-items-center rounded-lg bg-transparency-white-t8 text-sm font-bold text-primary-warm-white"
          aria-hidden="true"
        >
          {{ model.name[0] }}
        </span>
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-sm text-primary-warm-white">
            {{ model.name }}
          </span>
          <span class="truncate text-xs text-primary-warm-gray">
            {{ model.provider ?? t('workshop.card.partnerNode', locale) }}
            ·
            {{
              t('workshop.card.runs', locale).replace(
                '{n}',
                formatRuns(model.runs, locale)
              )
            }}
          </span>
        </span>
      </button>
    </section>

    <p v-else class="p-2 text-sm text-primary-warm-gray">
      {{ t('workshop.hub.facets.noResults', locale) }}
    </p>

    <section
      v-if="providerChips.chips.length"
      class="flex flex-wrap items-baseline gap-2"
    >
      <p
        class="text-[11px] font-bold tracking-wider text-primary-warm-gray uppercase"
      >
        {{ t('workshop.search.providers', locale) }}
      </p>
      <button
        v-for="chip in providerChips.chips"
        :key="chip.value"
        type="button"
        :aria-pressed="chip.selected"
        :class="chipClass(chip.selected)"
        data-testid="workshop-search-provider"
        @mousedown.prevent="emit('toggleProvider', chip.value)"
      >
        {{ chip.value }}
        <span class="tabular-nums opacity-60">{{ chip.count }}</span>
      </button>
      <span
        v-if="providerChips.more > 0"
        class="text-xs text-primary-warm-gray"
        data-testid="workshop-search-provider-more"
      >
        {{
          t('workshop.search.more', locale).replace(
            '{n}',
            `${providerChips.more}`
          )
        }}
      </span>
    </section>

    <section
      v-if="capabilityChips.chips.length"
      class="flex flex-wrap items-baseline gap-2"
    >
      <p
        class="text-[11px] font-bold tracking-wider text-primary-warm-gray uppercase"
      >
        {{ t('workshop.hub.categories', locale) }}
      </p>
      <button
        v-for="chip in capabilityChips.chips"
        :key="chip.value"
        type="button"
        :aria-pressed="chip.selected"
        :class="chipClass(chip.selected)"
        data-testid="workshop-search-capability"
        @mousedown.prevent="emit('toggleCapability', chip.value)"
      >
        {{ chip.value }}
        <span class="tabular-nums opacity-60">{{ chip.count }}</span>
      </button>
      <span
        v-if="capabilityChips.more > 0"
        class="text-xs text-primary-warm-gray"
        data-testid="workshop-search-capability-more"
      >
        {{
          t('workshop.search.more', locale).replace(
            '{n}',
            `${capabilityChips.more}`
          )
        }}
      </span>
    </section>
  </div>
</template>
