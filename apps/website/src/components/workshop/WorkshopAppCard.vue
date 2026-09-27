<script setup lang="ts">
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'

const { app } = defineProps<{ app: CatalogueApp }>()

const pillClass =
  'inline-flex h-6 w-fit shrink-0 items-center justify-center rounded-full bg-hub-surface px-4 py-1 text-xs font-normal whitespace-nowrap text-content'
</script>

<template>
  <a
    :href="app.href"
    class="group flex cursor-pointer flex-col gap-3 overflow-hidden rounded-4xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="workshop-app-card"
  >
    <div
      class="relative aspect-4/3 overflow-hidden rounded-3.5xl bg-hub-surface"
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

    <div class="flex flex-col gap-3 px-3">
      <h3
        class="line-clamp-2 h-10 overflow-hidden text-xs/5 font-medium text-content-bright lg:text-sm/5"
        :title="app.name"
        data-testid="app-card-name"
      >
        {{ app.name }}
      </h3>
      <div class="flex h-6 min-w-0 items-center gap-1.5 overflow-hidden">
        <span :class="pillClass" data-testid="app-card-task">
          {{ app.task }}
        </span>
      </div>
    </div>
  </a>
</template>
