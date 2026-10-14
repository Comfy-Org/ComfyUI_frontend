<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { getLogoPath } from '@/lib/hub/model-logos'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'

import WorkshopCardMark from './WorkshopCardMark.vue'
import WorkshopCardMedia from './WorkshopCardMedia.vue'

const { app, locale = 'en' } = defineProps<{
  app: CatalogueApp
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const logo = computed(() => getLogoPath(app.name))
</script>

<template>
  <a
    :href="app.href"
    class="group flex cursor-pointer flex-col gap-3 overflow-hidden rounded-3xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="workshop-app-card"
  >
    <div
      class="relative aspect-4/3 overflow-hidden rounded-2xl bg-hub-surface"
      data-testid="app-card-artwork"
    >
      <WorkshopCardMark :label="t('workshop.card.comfyApp')" :logo />
      <WorkshopCardMedia :model="app" />
    </div>

    <div class="flex flex-col gap-3 px-3">
      <h3
        class="truncate text-xs font-medium text-content-bright lg:text-sm"
        :title="app.name"
        data-testid="app-card-name"
      >
        {{ app.name }}
      </h3>
      <p
        class="line-clamp-2 text-xs/4 text-content-secondary"
        data-testid="app-card-task"
      >
        {{ app.task }}
      </p>
    </div>
  </a>
</template>
