<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  ModalityFilter,
  TaskInput,
  WorkshopModel
} from '../../config/workshop'
import { modalityOf, splitTask } from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { getLogoPath } from '../../lib/hub/model-logos'
import TagRow from '../hub/TagRow.vue'

const {
  model,
  locale = 'en',
  showStatus = false
} = defineProps<{
  model: WorkshopModel
  locale?: Locale
  showStatus?: boolean
}>()

const modality = computed(() => modalityOf(model))

const modalityLabelKey: Record<
  Exclude<ModalityFilter, 'all'>,
  TranslationKey
> = {
  image: 'workshop.filter.image',
  video: 'workshop.filter.video',
  audio: 'workshop.filter.audio',
  '3d': 'workshop.filter.3d',
  text: 'workshop.filter.text',
  other: 'workshop.filter.other'
}

const taskInputKey: Record<TaskInput, TranslationKey> = {
  text: 'workshop.task.text',
  image: 'workshop.task.image',
  video: 'workshop.task.video',
  audio: 'workshop.task.audio'
}

const providerName = computed(
  () => model.provider ?? t('workshop.card.partnerNode', locale)
)

const logo = computed(
  () => getLogoPath(model.provider ?? '') ?? getLogoPath(model.name)
)

const taskLabel = computed(() => {
  const task = model.task ? splitTask(model.task) : undefined
  return task && task.output !== 'other'
    ? t('workshop.task.label', locale)
        .replace('{input}', t(taskInputKey[task.input], locale))
        .replace('{output}', t(modalityLabelKey[task.output], locale))
    : t(modalityLabelKey[modality.value], locale)
})

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
    class="group bg-hub-surface hover:bg-hub-surface-hover flex cursor-pointer flex-col gap-4 overflow-hidden rounded-4xl px-2 pt-2 pb-6 transition-colors duration-200"
    data-testid="workshop-model-card"
  >
    <div
      class="bg-hub-surface relative aspect-4/3 overflow-hidden rounded-[1.75rem]"
    >
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
          class="font-formula text-primary-warm-white/20 text-7xl font-bold select-none"
          aria-hidden="true"
        >
          {{ model.name[0] }}
        </span>
      </div>

      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/70 via-black/30 to-transparent"
        aria-hidden="true"
      />
      <h3
        class="text-content-bright pointer-events-none absolute inset-x-5 bottom-5 z-10 line-clamp-2 text-base leading-[1.3] font-medium drop-shadow-md sm:text-lg lg:text-xl"
      >
        {{ model.name }}
      </h3>

      <span
        v-if="logo"
        role="img"
        :aria-label="providerName"
        :title="providerName"
        class="bg-transparency-white-t8 absolute top-4 right-4 z-10 grid size-10 place-items-center rounded-2xl backdrop-blur-sm"
        data-testid="model-card-logo"
      >
        <span
          class="size-5 bg-white mask-contain mask-center mask-no-repeat"
          :style="{ maskImage: `url(${logo})` }"
        />
      </span>
      <span
        v-if="showStatus && model.status"
        class="bg-primary-comfy-yellow/80 text-primary-comfy-ink absolute top-4 left-4 z-10 inline-flex h-8 items-center rounded-2xl px-3 text-[11px] font-bold tracking-wider uppercase backdrop-blur-sm"
      >
        {{
          model.status === 'deprecated'
            ? t('workshop.model.deprecated', locale)
            : t('workshop.model.degraded', locale)
        }}
      </span>
    </div>

    <div class="flex flex-col gap-4 px-4">
      <div class="flex items-center justify-between gap-2">
        <span class="text-content-secondary flex min-w-0 items-center gap-2">
          <span
            class="bg-brand text-page text-2xs grid size-5 shrink-0 place-items-center rounded-full font-bold"
            aria-hidden="true"
          >
            {{ providerName.charAt(0).toUpperCase() }}
          </span>
          <span
            class="ppformula-text-center-sm truncate text-base"
            data-testid="model-card-provider"
          >
            {{ providerName }}
          </span>
        </span>
        <span
          class="text-content group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink relative isolate inline-flex h-10 w-fit shrink-0 items-center overflow-hidden rounded-2xl bg-transparent ps-9 pe-0 text-sm font-bold tracking-wider text-nowrap uppercase transition-all duration-500 group-hover:pe-5"
        >
          <span
            class="grid grid-cols-[0fr] transition-[grid-template-columns] duration-500 group-hover:grid-cols-[1fr]"
          >
            <span class="overflow-hidden">
              <span class="ppformula-text-center relative leading-none">
                {{ t('workshop.hub.tryNow', locale) }}
              </span>
            </span>
          </span>
          <span
            class="group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink absolute top-1/2 left-1 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl bg-white/20 text-white transition-all duration-500"
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
