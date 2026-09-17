<script setup lang="ts">
import { computed } from 'vue'

import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import type { WorkshopOutcome } from '../../config/workshop-outcomes'
import { capabilitiesOf, outcomesIn } from '../../config/workshop-outcomes'
import type { HubTemplate } from '../../lib/hub/types'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import CardRow from '../workshop/CardRow.vue'
import WorkshopModelCard from '../workshop/WorkshopModelCard.vue'
import HubWorkflowCard from './HubWorkflowCard.vue'

// A row exists to be scanned, so it opens with enough to be worth scrolling
// and stops short of becoming the listing it is a way into.
const ROW_LIMIT = 12
const MIN_ENTRIES = 2

const {
  useCase,
  templates,
  models,
  hrefFor,
  tryNowLabel,
  locale = 'en'
} = defineProps<{
  useCase: UseCase | 'all'
  templates: readonly HubTemplate[]
  models: readonly WorkshopModel[]
  hrefFor: (template: HubTemplate) => string
  tryNowLabel: string
  locale?: Locale
}>()

const emit = defineEmits<{ seeAll: [outcome: WorkshopOutcome] }>()

// The workflows come first: a row named after a job is answered by a recipe
// before it is answered by a capability.
const shelves = computed(() =>
  outcomesIn(useCase)
    .map((outcome) => {
      const capabilities = capabilitiesOf(outcome)
      const rowTemplates = templates.filter((template) =>
        outcome.tags.some((tag) => template.tags.includes(tag))
      )
      const rowModels = models.filter((model) =>
        capabilities.some((capability) =>
          model.capabilities.includes(capability)
        )
      )
      return {
        outcome,
        total: rowTemplates.length + rowModels.length,
        templates: rowTemplates.slice(0, ROW_LIMIT),
        models: rowModels.slice(0, Math.max(0, ROW_LIMIT - rowTemplates.length))
      }
    })
    .filter((shelf) => shelf.total >= MIN_ENTRIES)
)
</script>

<template>
  <div class="flex flex-col gap-14" data-testid="hub-shelves">
    <CardRow
      v-for="shelf in shelves"
      :key="shelf.outcome.key"
      :locale
      :data-testid="`hub-shelf-${shelf.outcome.key}`"
    >
      <template #heading>
        <h2 class="text-2xl font-light text-primary-comfy-canvas">
          {{ t(shelf.outcome.labelKey, locale) }}
        </h2>
      </template>

      <template #actions>
        <button
          type="button"
          class="text-content-secondary hover:text-content focus-visible:ring-primary-comfy-yellow/50 cursor-pointer rounded-lg text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3"
          :data-testid="`hub-shelf-all-${shelf.outcome.key}`"
          @click="emit('seeAll', shelf.outcome)"
        >
          {{
            t('workshop.outcome.seeAll', locale).replace(
              '{n}',
              String(shelf.total)
            )
          }}
        </button>
      </template>

      <li
        v-for="template in shelf.templates"
        :key="template.name"
        class="w-80 shrink-0 snap-start"
      >
        <HubWorkflowCard
          :template
          :href="hrefFor(template)"
          :try-now-label="tryNowLabel"
          :locale
        />
      </li>
      <li
        v-for="model in shelf.models"
        :key="model.slug"
        class="w-80 shrink-0 snap-start"
      >
        <WorkshopModelCard :model :locale provider-badge />
      </li>
    </CardRow>
  </div>
</template>
