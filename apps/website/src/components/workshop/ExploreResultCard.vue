<script setup lang="ts">
import type { WorkshopModel } from '@/config/models-catalogue'
import WorkshopCardMedia from './WorkshopCardMedia.vue'

const { href, name, detail, model, newTab } = defineProps<{
  href?: string
  name: string
  detail: string
  model?: Pick<WorkshopModel, 'name' | 'thumbnail'>
  /** An app opens full screen in a tab of its own. */
  newTab?: boolean
}>()
</script>

<template>
  <a
    :href
    :target="newTab ? '_blank' : undefined"
    :rel="newTab ? 'noopener' : undefined"
    class="group flex h-full flex-col gap-3 overflow-hidden rounded-3xl bg-hub-surface p-2 pb-4 transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="explore-result"
  >
    <span class="relative block aspect-4/3 overflow-hidden rounded-2xl">
      <WorkshopCardMedia v-if="model" :model />
      <span v-else class="block size-full bg-hub-surface-hover" />
    </span>
    <span class="flex min-w-0 flex-col gap-1 px-3">
      <span class="truncate text-sm font-medium text-content-bright">
        {{ name }}
      </span>
      <span class="truncate text-xs text-content-secondary">
        {{ detail }}
      </span>
    </span>
  </a>
</template>
