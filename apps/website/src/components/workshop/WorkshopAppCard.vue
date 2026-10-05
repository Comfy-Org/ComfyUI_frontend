<script setup lang="ts">
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'

const { app } = defineProps<{ app: CatalogueApp }>()
</script>

<template>
  <a
    :href="app.href"
    class="group flex cursor-pointer flex-col gap-4 overflow-hidden rounded-3xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="workshop-app-card"
  >
    <div
      class="relative aspect-4/3 overflow-hidden rounded-2xl bg-hub-surface"
      data-testid="app-card-artwork"
    >
      <img
        v-if="app.image"
        :src="app.image"
        alt=""
        class="size-full object-cover transition-transform duration-300 select-none group-hover:scale-105"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
      <div
        v-else
        class="grid size-full place-items-center bg-hub-surface-hover"
        data-testid="app-media-placeholder"
      >
        <span
          class="font-formula text-7xl font-bold text-primary-warm-white/20 select-none"
          aria-hidden="true"
        >
          {{ app.name[0] }}
        </span>
      </div>
    </div>

    <div class="flex flex-col gap-2 px-3">
      <h3
        class="truncate text-sm/5 font-medium text-content-bright"
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
