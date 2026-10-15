<script setup lang="ts">
import { ArrowRight, Plus, X } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { MAX_COMPARED, MIN_COMPARED } from '@/lib/workshop/explorer/compare'
import { nameWithoutTask, taskLabelFor } from '@/lib/workshop/task-label'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const openSlots = computed(() => MAX_COMPARED - models.length)

function shortName(model: WorkshopModel) {
  return nameWithoutTask(model.name, taskLabelFor(model, locale))
}

function stillOf({ thumbnail }: WorkshopModel) {
  return thumbnail?.kind === 'image' ? thumbnail.url : thumbnail?.poster
}

defineEmits<{ remove: [slug: string]; clear: []; compare: [] }>()
</script>

<template>
  <section
    class="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-3xl bg-site-dropdown p-2 shadow-2xl ring-1 ring-transparency-white-t8 sm:gap-3"
    :aria-label="t('workshop.explorer.compare.trayLabel')"
    data-testid="compare-tray"
  >
    <ul class="flex min-w-0 items-center gap-2 sm:gap-3">
      <li
        v-for="model in models"
        :key="model.slug"
        class="flex min-w-0 items-center gap-3 rounded-2xl bg-transparency-white-t4 p-1.5 sm:w-64 sm:pr-2"
        data-testid="compare-pick"
      >
        <span
          class="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-hub-surface-hover text-sm font-semibold text-primary-warm-white/40"
          aria-hidden="true"
        >
          <img
            v-if="stillOf(model)"
            :src="stillOf(model)"
            alt=""
            class="size-full object-cover"
            loading="lazy"
          />
          <template v-else>{{ model.name[0] }}</template>
        </span>
        <span class="flex min-w-0 flex-1 flex-col max-sm:hidden">
          <span class="truncate text-sm font-medium text-primary-warm-white">
            {{ shortName(model) }}
          </span>
          <span
            v-if="model.provider"
            class="truncate text-xs text-primary-warm-gray"
          >
            {{ model.provider }}
          </span>
        </span>
        <button
          type="button"
          class="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-primary-warm-gray outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          :aria-label="
            t('workshop.explorer.compare.remove', { name: model.name })
          "
          @click="$emit('remove', model.slug)"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </li>
      <li
        v-for="slot in openSlots"
        :key="`slot-${slot}`"
        class="flex h-13 w-64 min-w-0 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-transparency-white-t20 text-sm text-primary-warm-gray max-lg:hidden"
        data-testid="compare-slot"
      >
        <Plus class="size-3.5" aria-hidden="true" />
        {{ t('workshop.explorer.compare.addSlot') }}
      </li>
    </ul>
    <div
      class="flex shrink-0 items-center gap-4 border-l border-transparency-white-t8 pl-4 max-sm:hidden"
    >
      <span
        class="text-sm whitespace-nowrap text-primary-warm-gray tabular-nums"
        data-testid="compare-count"
      >
        {{
          t('workshop.explorer.compare.picked', {
            count: models.length,
            max: MAX_COMPARED
          })
        }}
      </span>
      <button
        type="button"
        class="cursor-pointer rounded-lg text-sm font-semibold text-primary-warm-white outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="compare-clear"
        @click="$emit('clear')"
      >
        {{ t('workshop.explorer.compare.clear') }}
      </button>
    </div>
    <Button
      type="button"
      :append-icon="ArrowRight"
      :disabled="models.length < MIN_COMPARED"
      :aria-label="
        t(
          'workshop.explorer.compare.open',
          { count: models.length },
          { plural: models.length }
        )
      "
      class="h-11 shrink-0 rounded-full px-6"
      data-testid="compare-open"
      @click="$emit('compare')"
    >
      {{ t('workshop.explorer.compare.openShort', { count: models.length }) }}
    </Button>
  </section>
</template>
