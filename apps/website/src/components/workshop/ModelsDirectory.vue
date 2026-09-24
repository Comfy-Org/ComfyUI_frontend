<script setup lang="ts">
import { USE_CASES, useCaseFor } from '../../config/models-catalogue'
import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import { OTHER_FORMAT_USE_CASES } from '../../config/workshop-sections'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { taskLabelFor } from '../../lib/workshop/task-label'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

// The whole catalogue as plain links, one row per model under the shelf the
// interactive catalogue opens it on. This is the page a crawler, a reader
// without script, or a visitor still waiting on the island sees, so it
// carries no thumbnails and no controls, only what identifies each model.
type Shelf = { key: string; labelKey: TranslationKey }
const shelfKeys: readonly (UseCase | 'other')[] = [
  ...USE_CASES.filter((useCase) => !OTHER_FORMAT_USE_CASES.includes(useCase)),
  'other'
]
const shelves: readonly Shelf[] = shelfKeys.map((useCase) => ({
  key: useCase,
  labelKey: useCaseLabelKey[useCase]
}))

function shelfOf(model: WorkshopModel): string {
  const useCase = useCaseFor(model)
  if (!useCase) return 'unplaced'
  return OTHER_FORMAT_USE_CASES.includes(useCase) ? 'other' : useCase
}

const sections = [
  ...shelves,
  { key: 'unplaced', labelKey: 'workshop.filter.other' as const }
]
  .map((shelf) => ({
    ...shelf,
    label: t(shelf.labelKey, locale),
    models: models.filter((model) => shelfOf(model) === shelf.key)
  }))
  .filter((shelf) => shelf.models.length > 0)
</script>

<template>
  <div class="flex flex-col gap-10" data-testid="models-directory">
    <section
      v-for="section in sections"
      :key="section.key"
      :aria-labelledby="`directory-${section.key}`"
    >
      <h2
        :id="`directory-${section.key}`"
        class="mb-4 flex items-baseline gap-2 text-xl font-medium text-primary-warm-white"
      >
        {{ section.label }}
        <span class="text-sm text-primary-warm-gray tabular-nums">
          {{ section.models.length }}
        </span>
      </h2>
      <ul
        class="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <li
          v-for="model in section.models"
          :key="model.slug"
          class="flex flex-col"
        >
          <a
            :href="model.href"
            class="text-primary-comfy-canvas transition-colors hover:text-primary-comfy-yellow"
          >
            {{ model.name }}
          </a>
          <span class="text-xs text-primary-warm-gray">
            {{ model.provider ?? t('workshop.card.partnerNode', locale) }}
            · {{ taskLabelFor(model, locale) }}
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
