<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '@/config/models-catalogue'
import { useCaseFor } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { SHELF_CARD } from '@/lib/workshop/card-layout'
import { accessFor } from '@/lib/workshop/explorer/model-access'
import type { ExploreCount, ExploreEntry } from '@/lib/workshop/explore-search'
import { nameWithoutTask, taskLabelFor } from '@/lib/workshop/task-label'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import CardRow from './CardRow.vue'
import ExploreResultCard from './ExploreResultCard.vue'
import ExploreResultsHeading from './ExploreResultsHeading.vue'

const {
  title,
  description,
  entries,
  counts = [],
  locale = 'en'
} = defineProps<{
  title: string
  description?: string
  entries: readonly ExploreEntry[]
  counts?: readonly ExploreCount[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{ clear: [] }>()

function useCaseLabel(model: WorkshopModel): string[] {
  const useCase = useCaseFor(model)
  return useCase ? [t(useCaseLabelKey[useCase])] : []
}

function sourceOf(model: WorkshopModel): string | undefined {
  if (model.type === 'CLOUD' || model.type === 'SERVERLESS')
    return model.models?.join(', ') || undefined
  return model.provider
}

function nameOf(model: WorkshopModel): string {
  return model.workflowId
    ? model.name
    : nameWithoutTask(model.name, taskLabelFor(model, locale))
}

function keyOf(entry: ExploreEntry): string {
  return entry.kind === 'app' ? `app:${entry.app.key}` : entry.model.slug
}
</script>

<template>
  <section aria-labelledby="explore-results" data-testid="explore-results">
    <CardRow v-if="entries.length" :locale>
      <template #heading>
        <ExploreResultsHeading :title :description :counts :locale />
      </template>
      <li
        v-for="entry in entries"
        :key="keyOf(entry)"
        :class="cn(SHELF_CARD, 'relative')"
      >
        <ExploreResultCard
          v-if="entry.kind === 'app'"
          kind="app"
          :href="entry.app.href"
          new-tab
          :name="entry.app.name"
          :model="entry.app"
          :source="t('workshop.card.comfyApp')"
          :pills="[
            t(entry.app.href ? 'hubPages.apps.open' : 'hubPages.apps.soon')
          ]"
          :locale
        />
        <ExploreResultCard
          v-else
          :kind="entry.kind"
          :href="entry.model.href"
          :name="nameOf(entry.model)"
          :model="entry.model"
          :source="sourceOf(entry.model)"
          :pills="useCaseLabel(entry.model)"
          :access="accessFor(entry.model)"
          :locale
        />
      </li>
    </CardRow>
    <template v-else>
      <ExploreResultsHeading :title :description :locale class="mb-5" />
      <div
        class="flex flex-col items-start gap-3 rounded-3xl bg-hub-surface p-8"
        data-testid="explore-empty"
      >
        <p class="text-base text-content-secondary">
          {{ t('workshop.explore.empty') }}
        </p>
        <button
          type="button"
          class="cursor-pointer rounded-lg text-sm font-medium text-primary-comfy-yellow outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          @click="$emit('clear')"
        >
          {{ t('workshop.explore.clear') }}
        </button>
      </div>
    </template>
  </section>
</template>
