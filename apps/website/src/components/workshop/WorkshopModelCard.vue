<script setup lang="ts">
import { computed, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import HubTypeBadge from '@/components/hub/HubTypeBadge.vue'
import { getLogoPath } from '@/lib/hub/model-logos'
import { nameWithoutTask, taskLabelFor } from '@/lib/workshop/task-label'
import TagRow from '@/components/hub/TagRow.vue'
import ModelSupport from './ModelSupport.vue'
import WorkshopCardMark from './WorkshopCardMark.vue'
import WorkshopCardMedia from './WorkshopCardMedia.vue'

const {
  model,
  locale = 'en',
  providerBadge = false,
  underHeading = false
} = defineProps<{
  model: WorkshopModel
  locale?: Locale
  providerBadge?: boolean
  /** The card is listed under a heading that already names its kind. */
  underHeading?: boolean
}>()
const { t } = translationsFor(locale)

const workflow = computed(() =>
  model.type === 'CLOUD' || model.type === 'SERVERLESS' ? model : undefined
)
const workflowModels = computed(() =>
  model.type === 'CLOUD' || model.type === 'SERVERLESS'
    ? model.models
    : undefined
)
const providerName = computed(() =>
  model.type === 'APP'
    ? t('workshop.card.comfyApp')
    : (workflowModels.value?.join(', ') ??
      model.provider ??
      t('workshop.card.partnerNode'))
)

const logo = computed(
  () =>
    getLogoPath(workflowModels.value?.[0] ?? model.provider ?? '') ??
    getLogoPath(model.name)
)

const taskLabel = computed(() => taskLabelFor(model, locale))
// Only a product name repeats its task as a suffix. A workflow is named with
// a sentence, whose last word the pill may happen to match — "Upscale a video"
// beside "Video" — and dropping it leaves "Upscale a".
const cardName = computed(() =>
  workflow.value ? model.name : nameWithoutTask(model.name, taskLabel.value)
)
const thumbnailLabel = computed(() =>
  model.thumbnail ? model.thumbnailLabel : undefined
)

const id = useId()
const showsTask = computed(() => !workflow.value || !underHeading)
// The tags stay visible inside the link but out of its name.
const labelledBy = computed(() =>
  [
    `${id}-provider`,
    providerBadge && `${id}-kind`,
    model.incompleteReason && `${id}-support`,
    `${id}-name`,
    showsTask.value && `${id}-task`
  ]
    .filter(Boolean)
    .join(' ')
)

const pillClass =
  'inline-flex h-6 w-fit shrink-0 items-center justify-center rounded-full bg-hub-surface px-4 py-1 text-xs font-normal whitespace-nowrap text-content'
</script>

<template>
  <a
    :href="model.href"
    class="group flex cursor-pointer flex-col gap-3 overflow-hidden rounded-3xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    :aria-labelledby="labelledBy"
    data-testid="workshop-model-card"
    :data-kind="model.type === 'APP' ? 'app' : workflow ? 'workflow' : 'model'"
  >
    <div class="relative aspect-4/3 overflow-hidden rounded-2xl bg-hub-surface">
      <!-- First in the link, so the reader hears who answers for the card
        before its name rather than after everything else on it. -->
      <WorkshopCardMark :id="`${id}-provider`" :label="providerName" :logo />

      <!-- Only the hub mixes graphs, apps and models in one grid, so only
        there does a card have to say which it is. -->
      <HubTypeBadge
        v-if="providerBadge"
        :id="`${id}-kind`"
        kind="model"
        :locale
      />
      <ModelSupport
        v-if="model.incompleteReason"
        :id="`${id}-support`"
        :reason="model.incompleteReason"
        :locale
        class="absolute top-3 right-3 z-10"
      />

      <WorkshopCardMedia :model />

      <span
        v-if="thumbnailLabel"
        class="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border border-white/10 bg-site-dropdown/70 px-3 py-2 text-sm leading-none font-bold whitespace-nowrap text-primary-warm-white shadow-sm backdrop-blur-md transition-all duration-500 select-none group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:opacity-0"
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
        :id="`${id}-name`"
        :class="
          cn(
            'text-xs font-medium text-content-bright lg:text-sm',
            workflow ? 'line-clamp-2 h-[2lh]' : 'truncate'
          )
        "
        :title="model.name"
        data-testid="model-card-name"
      >
        {{ cardName }}
      </h3>
      <!-- Under a heading that names its kind, a workflow's artwork says the
          rest, so the line a tag would take goes to the name instead. Listed
          on its own — searched, filtered, or beside models — it keeps the tag,
          which is then the only place the kind is written. -->
      <div
        v-if="showsTask"
        class="flex h-6 min-w-0 items-center gap-1.5 overflow-hidden"
      >
        <span
          :id="`${id}-task`"
          :class="pillClass"
          data-testid="model-card-task"
        >
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
