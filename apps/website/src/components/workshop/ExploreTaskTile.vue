<script setup lang="ts">
import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'

const {
  useCase,
  cover,
  kinds,
  locale = 'en'
} = defineProps<{
  useCase: UseCase
  cover?: WorkshopModel['thumbnail']
  kinds: readonly string[]
  locale?: Locale
}>()

defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    class="group relative block aspect-3/4 w-full cursor-pointer overflow-hidden rounded-3xl bg-linear-to-br from-hub-surface-hover to-hub-surface text-left outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="explore-task"
    @click="$emit('select')"
  >
    <video
      v-if="cover?.kind === 'video'"
      :src="cover.url"
      class="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
      aria-hidden="true"
      data-testid="model-card-media"
      autoplay
      loop
      muted
      playsinline
      preload="metadata"
    />
    <img
      v-else-if="cover"
      :src="cover.url"
      alt=""
      class="absolute inset-0 size-full object-cover transition-transform duration-500 select-none group-hover:scale-105"
      data-testid="model-card-media"
      loading="lazy"
      decoding="async"
      draggable="false"
    />
    <span
      class="absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-transparent"
      aria-hidden="true"
    />
    <span class="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-5">
      <span class="text-xl/tight font-medium text-primary-warm-white">
        {{ t(useCaseLabelKey[useCase], locale) }}
      </span>
      <span
        class="flex items-center gap-2 text-xs tracking-wide text-primary-warm-white/70 uppercase"
      >
        <template v-for="(kind, index) in kinds" :key="kind">
          <span
            v-if="index"
            class="size-1 rounded-full bg-primary-comfy-yellow"
            aria-hidden="true"
          />
          <span data-testid="explore-task-kind">{{ kind }}</span>
        </template>
      </span>
    </span>
  </button>
</template>
