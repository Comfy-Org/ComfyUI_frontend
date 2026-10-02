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
    class="group flex w-full cursor-pointer flex-col gap-3 rounded-3xl bg-hub-surface p-2 pb-4 text-left transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="explore-task"
    @click="$emit('select')"
  >
    <span
      class="relative block aspect-4/3 overflow-hidden rounded-2xl bg-hub-surface"
    >
      <WorkshopCardMedia v-if="cover" :model="cover" />
    </span>
    <span class="flex flex-col gap-2 px-2">
      <span class="text-base/6 font-medium text-content-bright">
        {{ t(useCaseLabelKey[useCase], locale) }}
      </span>
      <span class="flex flex-wrap gap-1.5">
        <span
          v-for="kind in kinds"
          :key="kind"
          data-testid="explore-task-kind"
          class="rounded-full border border-transparency-white-t8 px-2.5 py-0.5 text-xs text-content-secondary"
        >
          {{ kind }}
        </span>
      </span>
    </span>
  </button>
</template>
