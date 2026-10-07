<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'

import WorkshopCardMedia from './WorkshopCardMedia.vue'

const {
  app,
  meta,
  locale = 'en'
} = defineProps<{
  app: CatalogueApp
  meta?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <component
    :is="app.href ? 'a' : 'div'"
    :href="app.href"
    :target="app.href && '_blank'"
    :rel="app.href && 'noopener'"
    :aria-disabled="app.href ? undefined : 'true'"
    :class="
      cn(
        'group flex h-full flex-col gap-3 overflow-hidden rounded-4xl bg-hub-surface px-2 pt-2 pb-5',
        app.href
          ? 'cursor-pointer transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
          : 'opacity-60'
      )
    "
    data-testid="workshop-app-card"
    :data-soon="app.href ? undefined : 'true'"
  >
    <div
      class="relative aspect-4/3 overflow-hidden rounded-3xl bg-hub-surface"
      data-testid="app-card-artwork"
    >
      <WorkshopCardMedia :model="app" />
      <span
        :class="
          cn(
            'absolute top-3 left-3 z-10 rounded-full px-2.5 py-1 text-2xs font-semibold tracking-wider uppercase',
            app.href
              ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
              : 'bg-primary-comfy-ink/75 text-primary-comfy-canvas'
          )
        "
        data-testid="app-card-status"
      >
        {{ t(app.href ? 'hubPages.apps.open' : 'hubPages.apps.soon') }}
      </span>
    </div>

    <div class="flex flex-col gap-1.5 px-3">
      <h3
        class="text-base font-semibold text-content-bright"
        data-testid="app-card-name"
      >
        {{ app.name }}
      </h3>
      <p
        class="line-clamp-2 text-sm/relaxed text-content-secondary"
        data-testid="app-card-task"
      >
        {{ app.task }}
      </p>
      <p v-if="meta" class="text-xs text-primary-warm-gray">{{ meta }}</p>
    </div>
    <span v-if="app.href" class="sr-only">{{
      t('hubPages.apps.opensInNewTab')
    }}</span>
  </component>
</template>
