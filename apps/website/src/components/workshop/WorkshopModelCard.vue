<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import HubTypeBadge from '../hub/HubTypeBadge.vue'
import { getLogoPath } from '../../lib/hub/model-logos'
import { taskLabelFor } from '../../lib/workshop/task-label'
import TagRow from '../hub/TagRow.vue'
import ModelSupport from './ModelSupport.vue'
import { usePreviewVideo } from '../../composables/usePreviewVideo'

const {
  model,
  locale = 'en',
  providerBadge = false
} = defineProps<{
  model: WorkshopModel
  locale?: Locale
  providerBadge?: boolean
}>()

const providerName = computed(
  () => model.provider ?? t('workshop.card.partnerNode', locale)
)

const logo = computed(
  () => getLogoPath(model.provider ?? '') ?? getLogoPath(model.name)
)

const taskLabel = computed(() => taskLabelFor(model, locale))
const thumbnailLabel = computed(() =>
  model.thumbnail ? model.thumbnailLabel : undefined
)
const video = useTemplateRef<HTMLVideoElement>('video')
const previewSrc = usePreviewVideo(video, () => model.thumbnail?.url)

const pillClass =
  'inline-flex h-6 w-fit shrink-0 items-center justify-center rounded-full bg-hub-surface px-4 py-1 text-xs font-normal whitespace-nowrap text-content'
</script>

<template>
  <a
    :href="model.href"
    class="group flex cursor-pointer flex-col gap-4 overflow-hidden rounded-4xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 hover:bg-hub-surface-hover"
    data-testid="workshop-model-card"
  >
    <div
      class="relative aspect-4/3 overflow-hidden rounded-[1.75rem] bg-hub-surface"
    >
      <!-- Only the hub mixes graphs, apps and models in one grid, so only
        there does a card have to say which it is. -->
      <HubTypeBadge v-if="providerBadge" kind="model" :locale />
      <ModelSupport
        v-if="model.incompleteReason"
        :reason="model.incompleteReason"
        :locale
        :class="
          cn(
            'absolute z-10',
            thumbnailLabel && providerBadge ? 'top-12 left-3' : 'top-3 right-3'
          )
        "
      />

      <video
        v-if="model.thumbnail?.kind === 'video'"
        ref="video"
        :src="previewSrc"
        :aria-label="model.name"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        muted
        loop
        playsinline
        preload="metadata"
      />
      <img
        v-else-if="model.thumbnail"
        :src="model.thumbnail.url"
        :alt="model.name"
        class="size-full object-cover transition-transform duration-300 select-none group-hover:scale-105"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
      <div
        v-else
        class="grid size-full place-items-center bg-hub-surface-hover"
        data-testid="model-media-placeholder"
      >
        <span
          class="font-formula text-7xl font-bold text-primary-warm-white/20 select-none"
          aria-hidden="true"
        >
          {{ model.name[0] }}
        </span>
      </div>

      <span
        v-if="thumbnailLabel"
        :class="
          cn(
            'pointer-events-none absolute z-10 rounded-xl border border-white/10 bg-site-dropdown px-3 py-2 text-sm leading-none font-bold whitespace-nowrap text-primary-warm-white shadow-sm transition-all duration-500 select-none group-hover:opacity-0',
            providerBadge
              ? 'top-3 right-3 group-hover:translate-x-1 group-hover:-translate-y-1'
              : 'bottom-3 left-3 group-hover:-translate-x-1 group-hover:translate-y-1'
          )
        "
        aria-hidden="true"
        data-testid="model-thumbnail-label"
      >
        {{ thumbnailLabel }}
      </span>

      <template v-if="providerBadge">
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/70 via-black/30 to-transparent"
          aria-hidden="true"
        />
        <h3
          class="pointer-events-none absolute right-16 bottom-5 left-5 z-10 line-clamp-2 text-sm/[1.35] font-medium text-content-bright drop-shadow-md lg:text-base"
        >
          {{ model.name }}
        </h3>
      </template>

      <!-- The mark names its provider on hover, as a tooltip: spelled out on
        the card it crossed the title. -->
      <span
        v-if="providerBadge"
        class="pointer-events-none absolute right-5 bottom-5 z-10 inline-flex items-center gap-1.5 text-white drop-shadow-md"
        :title="providerName"
        data-testid="model-card-provider-badge"
      >
        <span
          v-if="logo"
          class="size-5 shrink-0 bg-white mask-contain mask-center mask-no-repeat"
          :style="{ maskImage: `url(${logo})` }"
        />
        <span v-else class="text-sm font-bold">
          {{ providerName.charAt(0).toUpperCase() }}
        </span>
      </span>
    </div>

    <div class="flex flex-col gap-3 px-3">
      <div class="flex min-w-0 items-center gap-2 text-content-secondary">
        <!-- With the mark over the thumbnail, repeating it here would say the
            same thing twice. -->
        <span
          v-if="!providerBadge && logo"
          role="img"
          :aria-label="providerName"
          class="grid size-5 shrink-0 place-items-center"
          data-testid="model-card-logo"
        >
          <span
            class="size-5 bg-content-secondary mask-contain mask-center mask-no-repeat"
            :style="{ maskImage: `url(${logo})` }"
          />
        </span>
        <span
          v-else-if="!providerBadge"
          class="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-2xs font-bold text-page"
          aria-hidden="true"
        >
          {{ providerName.charAt(0).toUpperCase() }}
        </span>
        <span
          v-if="providerBadge"
          class="ppformula-text-center-sm truncate text-sm"
          data-testid="model-card-provider"
        >
          {{ providerName }}
        </span>
        <!-- The name reads better beside the mark than over the artwork, and
            the mark says the provider without spending a line on it. -->
        <h3
          v-else
          class="truncate text-sm font-medium text-content-bright"
          data-testid="model-card-name"
        >
          {{ model.name }}
        </h3>
      </div>
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
