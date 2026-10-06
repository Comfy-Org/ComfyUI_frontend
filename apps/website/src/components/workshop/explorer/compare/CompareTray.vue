<script setup lang="ts">
import { X } from '@lucide/vue'
import { computed } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { MAX_COMPARED, MIN_COMPARED } from '@/lib/workshop/explorer/compare'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const hint = computed(() => {
  const count = models.length
  if (count < MIN_COMPARED)
    return t('workshop.explorer.compare.pickMore', {
      count: MIN_COMPARED - count
    })
  if (count < MAX_COMPARED)
    return t('workshop.explorer.compare.canAdd', {
      count: MAX_COMPARED - count
    })
  return undefined
})

defineEmits<{ remove: [slug: string]; clear: []; compare: [] }>()
</script>

<template>
  <section
    class="fixed inset-x-4 bottom-4 z-40 flex flex-wrap items-center gap-2 rounded-2xl bg-site-dropdown p-2 shadow-2xl ring-1 ring-transparency-white-t8 lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2"
    :aria-label="t('workshop.explorer.compare.trayLabel')"
    data-testid="compare-tray"
  >
    <ul class="contents">
      <li
        v-for="model in models"
        :key="model.slug"
        class="inline-flex h-8 items-center gap-1 rounded-xl bg-transparency-white-t8 pr-1 pl-3 text-xs text-primary-warm-white"
      >
        {{ model.name }}
        <button
          type="button"
          class="grid size-6 cursor-pointer place-items-center rounded-lg text-primary-warm-gray outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          :aria-label="
            t('workshop.explorer.compare.remove', { name: model.name })
          "
          @click="$emit('remove', model.slug)"
        >
          <X class="size-3.5" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <button
      type="button"
      class="h-9 cursor-pointer rounded-xl px-3 text-xs text-primary-warm-gray outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      data-testid="compare-clear"
      @click="$emit('clear')"
    >
      {{ t('workshop.explorer.compare.clear') }}
    </button>
    <div class="ml-auto flex items-center gap-3">
      <span
        v-if="hint"
        class="text-xs text-primary-warm-gray"
        data-testid="compare-hint"
      >
        {{ hint }}
      </span>
      <button
        type="button"
        class="inline-flex h-9 cursor-pointer items-center rounded-xl bg-primary-comfy-yellow px-4 text-xs font-bold tracking-wider text-primary-comfy-ink uppercase outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="models.length < MIN_COMPARED"
        data-testid="compare-open"
        @click="$emit('compare')"
      >
        {{
          t(
            'workshop.explorer.compare.open',
            { count: models.length },
            { plural: models.length }
          )
        }}
      </button>
    </div>
  </section>
</template>
