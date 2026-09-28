<script setup lang="ts">
import { computed } from 'vue'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import HubTypeBadge from '../hub/HubTypeBadge.vue'
import { getLogoPath } from '../../lib/hub/model-logos'
import { taskLabelFor } from '../../lib/workshop/task-label'
import TagRow from '../hub/TagRow.vue'
import ModelSupport from './ModelSupport.vue'
import WorkshopCardMark from './WorkshopCardMark.vue'
import WorkshopCardMedia from './WorkshopCardMedia.vue'

const {
  model,
  locale = 'en',
  providerBadge = false
} = defineProps<{
  model: WorkshopModel
  locale?: Locale
  providerBadge?: boolean
}>()

const workflow = computed(() =>
  model.routerId === undefined ? model : undefined
)
const providerName = computed(
  () =>
    workflow.value?.models?.join(', ') ??
    model.provider ??
    t('workshop.card.partnerNode', locale)
)

const logo = computed(
  () =>
    getLogoPath(workflow.value?.models?.[0] ?? model.provider ?? '') ??
    getLogoPath(model.name)
)

const taskLabel = computed(() => taskLabelFor(model, locale))
const thumbnailLabel = computed(() =>
  model.thumbnail ? model.thumbnailLabel : undefined
)

const pillClass =
  'inline-flex h-6 w-fit shrink-0 items-center justify-center rounded-full bg-hub-surface px-4 py-1 text-xs font-normal whitespace-nowrap text-content'
</script>

<template>
  <a
    :href="model.href"
    class="group flex cursor-pointer flex-col gap-3 overflow-hidden rounded-4xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 hover:bg-hub-surface-hover"
    data-testid="workshop-model-card"
    :data-kind="workflow ? 'workflow' : 'model'"
  >
    <div
      class="relative aspect-4/3 overflow-hidden rounded-3.5xl bg-hub-surface"
    >
      <!-- First in the link, so the reader hears who answers for the card
        before its name rather than after everything else on it. -->
      <WorkshopCardMark :label="providerName" :logo />

      <!-- Only the hub mixes graphs, apps and models in one grid, so only
        there does a card have to say which it is. -->
      <HubTypeBadge v-if="providerBadge" kind="model" :locale />
      <ModelSupport
        v-if="model.incompleteReason"
        :reason="model.incompleteReason"
        :locale
        class="absolute top-3 right-3 z-10"
      />

      <WorkshopCardMedia :model />

      <span
        v-if="thumbnailLabel"
        class="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border border-white/10 bg-site-dropdown px-3 py-2 text-sm leading-none font-bold whitespace-nowrap text-primary-warm-white shadow-sm transition-all duration-500 select-none group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:opacity-0"
        aria-hidden="true"
        data-testid="model-thumbnail-label"
      >
        {{ thumbnailLabel }}
      </span>
    </div>

    <div class="flex flex-col gap-3 px-3">
      <!-- The mark over the artwork already says who answers for this, so the
          line under it is the card's own name and nothing else. -->
      <h3
        class="truncate text-xs font-medium text-content-bright lg:text-sm"
        :title="model.name"
        data-testid="model-card-name"
      >
        {{ model.name }}
      </h3>
      <div class="flex h-6 min-w-0 items-center gap-1.5 overflow-hidden">
        <span :class="pillClass" data-testid="model-card-task">
          {{ taskLabel }}
        </span>
        <TagRow
          :tags="model.capabilities"
          :link-tags="false"
          class="min-w-0 flex-1"
        />
      </div>
    </div>
  </a>
</template>
