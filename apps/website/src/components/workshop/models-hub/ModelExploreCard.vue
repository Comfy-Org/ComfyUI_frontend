<script setup lang="ts">
import { computed } from 'vue'

import Badge from '@/components/ui/badge/Badge.vue'
import WorkshopCardMark from '@/components/workshop/WorkshopCardMark.vue'
import WorkshopCardMedia from '@/components/workshop/WorkshopCardMedia.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { getLogoPath } from '@/lib/hub/model-logos'
import ModelCardTags from './ModelCardTags.vue'

const {
  model,
  badge,
  locale = 'en'
} = defineProps<{
  model: WorkshopModel
  badge?: string
  locale?: Locale
}>()

const provider = computed(() => model.provider ?? model.name)
const logo = computed(() => getLogoPath(provider.value))
</script>

<template>
  <a
    :href="model.href"
    class="group flex h-full min-w-0 flex-col gap-3 overflow-hidden rounded-3xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
  >
    <div
      class="relative aspect-video overflow-hidden rounded-2xl bg-hub-surface"
    >
      <Badge
        v-if="badge"
        variant="accent"
        class="pointer-events-none absolute top-3 left-3 z-10"
      >
        {{ badge }}
      </Badge>
      <WorkshopCardMark :label="provider" :logo />
      <WorkshopCardMedia :model />
    </div>
    <div class="flex grow flex-col gap-3 px-3">
      <h2 class="text-2xl font-medium text-content-bright">
        {{ model.name }}
      </h2>
      <p
        v-if="model.summary"
        class="line-clamp-3 text-sm/relaxed font-light text-content-secondary"
      >
        {{ model.summary }}
      </p>
      <ModelCardTags :model :locale />
    </div>
  </a>
</template>
