<script setup lang="ts">
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'

const { app } = defineProps<{ app: CatalogueApp }>()
</script>

<template>
  <a
    :href="app.href"
    class="group flex cursor-pointer flex-col gap-4 overflow-hidden rounded-4xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 hover:bg-hub-surface-hover"
    data-testid="workshop-app-card"
  >
    <div
      class="relative aspect-4/3 overflow-hidden rounded-3.5xl bg-hub-surface"
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
      <span
        class="absolute top-3 left-3 z-10 rounded-full bg-primary-comfy-yellow px-2.5 py-1 text-2xs font-semibold tracking-wider text-primary-comfy-ink uppercase"
        data-testid="app-card-badge"
      >
        {{ app.badge }}
      </span>
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/70 via-black/30 to-transparent"
        aria-hidden="true"
      />
      <h3
        class="pointer-events-none absolute right-5 bottom-5 left-5 z-10 line-clamp-2 text-sm/[1.35] font-medium text-content-bright drop-shadow-md lg:text-base"
        :title="app.name"
      >
        {{ app.name }}
      </h3>
    </div>

    <p
      class="line-clamp-2 min-h-13 px-3 text-sm/6.5 text-content-secondary"
      data-testid="app-card-summary"
    >
      {{ app.summary }}
    </p>
  </a>
</template>
