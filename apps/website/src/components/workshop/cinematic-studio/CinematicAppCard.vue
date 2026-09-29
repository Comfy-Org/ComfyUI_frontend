<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { name, summary, badge, meta, image, href } = defineProps<{
  name: string
  summary: string
  badge: string
  meta?: string
  image?: string
  href?: string
}>()
</script>

<template>
  <li
    :class="
      cn(
        'group relative flex flex-col gap-3 rounded-4xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200',
        href ? 'hover:bg-hub-surface-hover' : 'opacity-60'
      )
    "
  >
    <a
      v-if="href"
      :href="href"
      class="absolute inset-0 z-10 rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    >
      <span class="sr-only">{{ name }}</span>
    </a>
    <div
      class="relative aspect-4/3 overflow-hidden rounded-3xl bg-hub-surface-hover"
    >
      <img
        v-if="image"
        :src="image"
        alt=""
        loading="lazy"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <span
        v-else
        class="grid size-full place-items-center font-formula text-7xl font-bold text-primary-warm-white/20 select-none"
        aria-hidden="true"
      >
        {{ name.charAt(0) }}
      </span>
      <span
        :class="
          cn(
            'absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase',
            href
              ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
              : 'bg-primary-comfy-ink/70 text-primary-comfy-canvas'
          )
        "
      >
        {{ badge }}
      </span>
    </div>
    <div class="flex flex-col gap-1.5 px-3">
      <h3 class="text-sm font-semibold text-content-bright">
        {{ name }}
      </h3>
      <p class="line-clamp-2 text-xs/relaxed text-content-secondary">
        {{ summary }}
      </p>
      <p v-if="meta" class="text-xs text-primary-warm-gray">
        {{ meta }}
      </p>
    </div>
  </li>
</template>
