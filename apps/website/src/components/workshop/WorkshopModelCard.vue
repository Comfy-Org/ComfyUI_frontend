<script setup lang="ts">
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
import CardArrow from '../common/CardArrow.vue'

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
  'inline-flex h-8 items-center rounded-2xl bg-white/20 px-3 text-[11px] font-bold tracking-wider text-white uppercase backdrop-blur-sm'
</script>

<template>
  <a
    :href="model.href"
    class="group bg-primary-comfy-ink-light relative block aspect-4/5 overflow-hidden rounded-3xl"
    data-testid="workshop-model-card"
  >
    <img
      v-if="model.thumbnailUrl"
      :src="model.thumbnailUrl"
      :alt="model.name"
      class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
      decoding="async"
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
      class="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-black/35"
    />

    <span
      v-if="showStatus && model.status"
      :class="cn(pillClass, 'bg-primary-comfy-yellow/80 absolute top-4 left-4')"
    >
      {{
        model.status === 'deprecated'
          ? t('workshop.model.deprecated', locale)
          : t('workshop.model.degraded', locale)
      }}
    </span>

    <div class="absolute right-16 bottom-5 left-5">
      <div class="flex items-center gap-2">
        <p
          class="text-primary-warm-white min-w-0 text-2xl/tight font-light drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
        >
          {{ model.name }}
        </p>
        <span
          v-if="logo"
          role="img"
          :aria-label="model.provider ?? model.name"
          :title="model.provider ?? model.name"
          class="grid size-7 shrink-0 place-items-center rounded-lg bg-white/20 backdrop-blur-sm"
          data-testid="model-card-logo"
        >
          <span
            class="size-4 bg-white mask-contain mask-center mask-no-repeat"
            :style="{ maskImage: `url(${logo})` }"
          />
        </span>
        <span
          v-else-if="model.provider"
          :class="cn(pillClass, 'text-2xs h-6 shrink-0 px-2')"
          data-testid="model-card-provider"
        >
          {{ model.provider }}
        </span>
      </div>
      <p
        class="text-primary-comfy-canvas/80 mt-1 text-sm"
        data-testid="model-card-task"
      >
        {{ taskLabel }}
      </p>
    </div>

    <CardArrow hover="group" class="absolute right-4 bottom-4" />
  </a>
</template>
