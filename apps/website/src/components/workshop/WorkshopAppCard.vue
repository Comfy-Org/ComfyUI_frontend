<script setup lang="ts">
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'

import WorkshopCardMedia from './WorkshopCardMedia.vue'

const { app } = defineProps<{ app: CatalogueApp }>()
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
