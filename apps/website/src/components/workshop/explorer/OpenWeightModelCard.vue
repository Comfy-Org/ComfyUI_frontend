<script setup lang="ts">
import { useId } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { getLogoPath } from '@/lib/hub/model-logos'
import { OPEN_WEIGHT_ACCESS } from '@/lib/workshop/explorer/model-access'
import type { OpenWeightModel } from '@/lib/workshop/explorer/open-weight-models'
import { openWeightHref } from '@/lib/workshop/explorer/open-weight-models'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import WorkshopCardMark from '@/components/workshop/WorkshopCardMark.vue'
import ModelAccessBadges from './ModelAccessBadges.vue'

const { model, locale = 'en' } = defineProps<{
  model: OpenWeightModel
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const id = useId()
const pillClass =
  'inline-flex h-6 w-fit shrink-0 items-center justify-center rounded-full bg-hub-surface px-4 py-1 text-xs font-normal whitespace-nowrap text-content'
</script>

<template>
  <a
    :href="openWeightHref(model)"
    class="group flex cursor-pointer flex-col gap-3 overflow-hidden rounded-3xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    :aria-labelledby="
      [model.provider && `${id}-provider`, `${id}-name`, `${id}-task`]
        .filter(Boolean)
        .join(' ')
    "
    data-testid="open-weight-model-card"
  >
    <div class="relative aspect-4/3 overflow-hidden rounded-2xl bg-hub-surface">
      <WorkshopCardMark
        v-if="model.provider"
        :id="`${id}-provider`"
        :label="model.provider"
        :logo="getLogoPath(model.provider) ?? getLogoPath(model.name)"
      />
      <img
        :src="model.thumbnailUrl"
        alt=""
        class="size-full object-cover transition-transform duration-300 select-none group-hover:scale-105"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
    </div>

    <div class="flex flex-col gap-3 px-3">
      <h3
        :id="`${id}-name`"
        class="truncate text-xs font-medium text-content-bright lg:text-sm"
        :title="model.name"
      >
        {{ model.name }}
      </h3>
      <div class="flex h-6 min-w-0 items-center gap-1.5 overflow-hidden">
        <span :id="`${id}-task`" :class="pillClass">
          {{ t(useCaseLabelKey[model.useCase]) }}
        </span>
        <ModelAccessBadges :access="OPEN_WEIGHT_ACCESS" :locale />
      </div>
    </div>
  </a>
</template>
