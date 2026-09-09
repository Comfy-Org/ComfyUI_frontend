<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  ModalityFilter,
  WorkshopModel
} from '../../config/models-catalogue'
import { modalityOf } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import HubTypeBadge from '../hub/HubTypeBadge.vue'
import { getLogoPath } from '../../lib/hub/model-logos'
import { taskLabelFor } from '../../lib/workshop/task-label'
import TagRow from '../hub/TagRow.vue'

const {
  model,
  locale = 'en',
  providerBadge = false
} = defineProps<{
  model: WorkshopModel
  locale?: Locale
  providerBadge?: boolean
}>()

const modality = computed(() => modalityOf(model))

const providerName = computed(
  () => model.provider ?? t('workshop.card.partnerNode', locale)
)

const logo = computed(
  () => getLogoPath(model.provider ?? '') ?? getLogoPath(model.name)
)

const taskLabel = computed(() => taskLabelFor(model, locale))

const modalityTone: Record<Exclude<ModalityFilter, 'all'>, string> = {
  image: 'from-primary-comfy-plum to-secondary-deep-plum',
  video: 'from-secondary-mauve to-primary-comfy-plum',
  audio: 'from-illustration-forest to-primary-comfy-ink-light',
  '3d': 'from-primary-comfy-yellow/70 to-primary-comfy-ink-light',
  text: 'from-secondary-cool-gray to-primary-comfy-ink-light',
  other: 'from-primary-comfy-ink-light to-primary-comfy-ink'
}

const pillClass =
  'inline-flex h-6 w-fit shrink-0 items-center justify-center rounded-full bg-hub-surface px-4 py-1 text-xs font-normal whitespace-nowrap text-content'
</script>

<template>
  <a
    :href="model.href"
    class="group bg-hub-surface hover:bg-hub-surface-hover flex cursor-pointer flex-col gap-4 overflow-hidden rounded-4xl px-2 pt-2 pb-4 transition-colors duration-200"
    data-testid="workshop-model-card"
  >
    <div
      class="bg-hub-surface relative aspect-4/3 overflow-hidden rounded-[1.75rem]"
    >
      <!-- Only the hub mixes graphs, apps and models in one grid, so only
        there does a card have to say which it is. -->
      <HubTypeBadge v-if="providerBadge" kind="model" :locale />

      <img
        v-if="model.thumbnailUrl"
        :src="model.thumbnailUrl"
        :alt="model.name"
        class="size-full object-cover transition-transform duration-300 select-none group-hover:scale-105"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
      <div
        v-else
        :class="
          cn(
            'grid size-full place-items-center bg-linear-to-br',
            modalityTone[modality]
          )
        "
      >
        <span
          class="font-formula text-7xl font-bold text-primary-warm-white/20 select-none"
          aria-hidden="true"
        >
          {{ model.name[0] }}
        </span>
      </div>

      <template v-if="providerBadge">
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/70 via-black/30 to-transparent"
          aria-hidden="true"
        />
        <h3
          class="text-content-bright pointer-events-none absolute right-16 bottom-5 left-5 z-10 line-clamp-2 text-sm leading-[1.35] font-medium drop-shadow-md lg:text-base"
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

    <div class="flex flex-col gap-2 px-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-content-secondary flex min-w-0 items-center gap-2">
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
              class="bg-content-secondary size-5 mask-contain mask-center mask-no-repeat"
              :style="{ maskImage: `url(${logo})` }"
            />
          </span>
          <span
            v-else-if="!providerBadge"
            class="bg-brand text-page grid size-5 shrink-0 place-items-center rounded-full text-2xs font-bold"
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
            class="text-content-bright truncate text-sm font-medium"
            data-testid="model-card-name"
          >
            {{ model.name }}
          </h3>
        </span>
        <span
          class="text-content group-hover:bg-primary-comfy-yellow group-focus-visible:bg-primary-comfy-yellow relative isolate inline-flex h-10 w-fit shrink-0 items-center overflow-hidden rounded-2xl bg-transparent ps-9 pe-0 text-sm font-bold tracking-wider text-nowrap uppercase transition-all duration-500 group-hover:pe-5 group-hover:text-primary-comfy-ink group-focus-visible:pe-5 group-focus-visible:text-primary-comfy-ink"
        >
          <span
            class="grid grid-cols-[0fr] transition-[grid-template-columns] duration-500 group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr]"
          >
            <span class="overflow-hidden">
              <span class="ppformula-text-center relative leading-none">
                {{ t('workshop.hub.tryNow', locale) }}
              </span>
            </span>
          </span>
          <span
            class="group-hover:bg-primary-comfy-yellow group-focus-visible:bg-primary-comfy-yellow absolute top-1/2 left-1 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl bg-white/20 text-white transition-all duration-500 group-hover:text-primary-comfy-ink group-focus-visible:text-primary-comfy-ink"
            aria-hidden="true"
          >
            <ChevronRight class="size-4" :stroke-width="2" />
          </span>
        </span>
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
