<script setup lang="ts">
import { computed } from 'vue'

import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'
import WorkshopCardMedia from './WorkshopCardMedia.vue'

const {
  useCase,
  items,
  locale = 'en'
} = defineProps<{
  useCase: UseCase
  items: readonly WorkshopModel[]
  locale?: Locale
}>()

defineEmits<{ select: [] }>()

const cover = computed(
  () =>
    items.find((item) => item.thumbnail?.kind === 'image') ??
    items.find((item) => item.thumbnail)
)
const kinds = computed(() => [
  ...(items.some((item) => item.workflowId)
    ? [t('workshop.explore.workflowPill', locale)]
    : []),
  ...(items.some((item) => item.routerId)
    ? [t('workshop.explore.kindModel', locale)]
    : [])
])
</script>

<template>
  <button
    type="button"
    class="group relative block aspect-3/4 w-full cursor-pointer overflow-hidden rounded-3xl bg-linear-to-br from-hub-surface-hover to-hub-surface text-left outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="explore-task"
    @click="$emit('select')"
  >
    <span
      class="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
    >
      <WorkshopCardMedia v-if="cover" :model="cover" />
    </span>
    <span
      class="absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent"
      aria-hidden="true"
    />
    <span class="absolute top-3 left-3 flex flex-wrap gap-1.5">
      <span
        v-for="kind in kinds"
        :key="kind"
        data-testid="explore-task-kind"
        class="rounded-full bg-black/40 px-2.5 py-0.5 text-xs text-white backdrop-blur-md"
      >
        {{ kind }}
      </span>
    </span>
    <span
      class="absolute inset-x-0 bottom-0 p-4 text-xl/tight font-medium text-primary-warm-white"
    >
      {{ t(useCaseLabelKey[useCase], locale) }}
    </span>
  </button>
</template>
