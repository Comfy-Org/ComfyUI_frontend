<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import type { ModelAccess } from '@/lib/workshop/explorer/model-access'
import type { ExploreKind } from '@/lib/workshop/explore-search'
import ModelAccessBadges from './explorer/ModelAccessBadges.vue'
import ExploreKindTag from './ExploreKindTag.vue'
import WorkshopCardMedia from './WorkshopCardMedia.vue'

const {
  href,
  newTab,
  kind,
  name,
  model,
  source,
  pills = [],
  access = [],
  locale = 'en'
} = defineProps<{
  /** Absent for something not open yet: the card is shown, dimmed, unlinked. */
  href?: string
  /** An app opens full screen in a tab of its own. */
  newTab?: boolean
  kind?: ExploreKind
  name: string
  model?: Pick<WorkshopModel, 'name' | 'thumbnail'>
  /** Who makes it or what it runs on, chipped over the artwork. */
  source?: string
  pills?: readonly string[]
  access?: readonly ModelAccess[]
  locale?: Locale
}>()

const pillClass =
  'inline-flex h-6 w-fit shrink-0 items-center justify-center rounded-full bg-hub-surface px-3 py-1 text-xs font-normal whitespace-nowrap text-content'
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    :href
    :target="href && newTab ? '_blank' : undefined"
    :rel="href && newTab ? 'noopener' : undefined"
    :aria-disabled="href ? undefined : 'true'"
    :class="
      cn(
        'group flex h-full flex-col gap-3 overflow-hidden rounded-3xl bg-hub-surface p-2 pb-4',
        href
          ? 'transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
          : 'opacity-60'
      )
    "
    data-testid="explore-result"
  >
    <span class="relative block aspect-4/3 overflow-hidden rounded-2xl">
      <WorkshopCardMedia v-if="model" :model />
      <span v-else class="block size-full bg-hub-surface-hover" />
      <span
        v-if="source"
        class="pointer-events-none absolute right-3 bottom-3 z-10 max-w-7/10 truncate rounded-lg bg-black/45 px-2 py-1 text-2xs font-semibold text-white backdrop-blur-md"
        data-testid="explore-source"
      >
        {{ source }}
      </span>
    </span>
    <span class="flex min-w-0 flex-col gap-2.5 px-3">
      <span class="truncate text-sm font-medium text-content-bright">
        {{ name }}
      </span>
      <span
        v-if="kind || pills.length || access.length"
        class="flex h-6 min-w-0 items-center gap-1.5 overflow-hidden"
        data-testid="explore-pills"
      >
        <ExploreKindTag v-if="kind" :kind :locale />
        <span v-for="pill in pills" :key="pill" :class="pillClass">
          {{ pill }}
        </span>
        <ModelAccessBadges v-if="access.length" :access :locale />
      </span>
    </span>
  </component>
</template>
