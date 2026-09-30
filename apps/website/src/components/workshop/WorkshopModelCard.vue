<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import HubTypeBadge from '../hub/HubTypeBadge.vue'
import { getLogoPath } from '../../lib/hub/model-logos'
import { nameWithoutTask, taskLabelFor } from '../../lib/workshop/task-label'
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
  model.type === 'CLOUD' || model.type === 'SERVERLESS' ? model : undefined
)
const workflowModels = computed(() =>
  model.type === 'CLOUD' || model.type === 'SERVERLESS'
    ? model.models
    : undefined
)
const providerName = computed(() =>
  model.type === 'APP'
    ? t('workshop.card.comfyApp', {}, { locale })
    : (workflowModels.value?.join(', ') ??
      model.provider ??
      t('workshop.card.partnerNode', {}, { locale }))
)

const logo = computed(
  () =>
    getLogoPath(workflowModels.value?.[0] ?? model.provider ?? '') ??
    getLogoPath(model.name)
)

const taskLabel = computed(() => taskLabelFor(model, locale))
const cardName = computed(() => nameWithoutTask(model.name, taskLabel.value))
const thumbnailLabel = computed(() =>
  model.thumbnail ? model.thumbnailLabel : undefined
)

const name = useTemplateRef<HTMLElement>('name')
const nameClips = ref(false)
let measuredWidth = -1

// Hovering re-clamps the name to two lines, so a measurement taken then would
// read "it fits". Only a change of width can change the answer.
useResizeObserver(name, ([entry]) => {
  if (entry.contentRect.width === measuredWidth) return
  measuredWidth = entry.contentRect.width
  const element = name.value
  if (element) nameClips.value = element.scrollHeight > element.clientHeight
})

const pillClass =
  'inline-flex h-6 w-fit shrink-0 items-center justify-center rounded-full bg-hub-surface px-4 py-1 text-xs font-normal whitespace-nowrap text-content'
</script>

<template>
  <a
    :href="model.href"
    class="group flex cursor-pointer flex-col gap-3 overflow-hidden rounded-3xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="workshop-model-card"
    :data-kind="model.type === 'APP' ? 'app' : workflow ? 'workflow' : 'model'"
  >
    <div class="relative aspect-4/3 overflow-hidden rounded-2xl bg-hub-surface">
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
        class="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border border-white/10 bg-site-dropdown/70 px-3 py-2 text-sm leading-none font-bold whitespace-nowrap text-primary-warm-white shadow-sm backdrop-blur-md transition-all duration-500 select-none group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:opacity-0"
        aria-hidden="true"
        data-testid="model-thumbnail-label"
      >
        {{ thumbnailLabel }}
      </span>
    </div>

    <!-- A workflow carries one tag, so hovering can spend its line on a name
        that does not fit. A model carries several and keeps them. -->
    <div :class="cn('flex flex-col gap-3 px-3', workflow && 'h-13 lg:h-14')">
      <!-- The mark over the artwork already says who answers for this, so the
          line under it is the card's own name and nothing else. -->
      <h3
        ref="name"
        :class="
          cn(
            'text-xs font-medium text-content-bright lg:text-sm',
            workflow ? 'line-clamp-1' : 'truncate',
            workflow &&
              nameClips &&
              'group-hover:line-clamp-2 group-focus-visible:line-clamp-2'
          )
        "
        :title="model.name"
        data-testid="model-card-name"
      >
        {{ cardName }}
      </h3>
      <div
        :class="
          cn(
            'flex h-6 min-w-0 items-center gap-1.5 overflow-hidden',
            workflow &&
              nameClips &&
              'group-hover:hidden group-focus-visible:hidden'
          )
        "
      >
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
