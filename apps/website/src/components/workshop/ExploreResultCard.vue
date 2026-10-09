<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import Badge from '@/components/ui/badge/Badge.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import type { ExploreKind } from '@/lib/workshop/explore-search'
import ExploreKindTag from './ExploreKindTag.vue'
import WorkshopCardMark from './WorkshopCardMark.vue'
import WorkshopCardMedia from './WorkshopCardMedia.vue'

const {
  href,
  newTab,
  kind,
  name,
  model,
  source,
  logo = null,
  pills = [],
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
  logo?: string | null
  pills?: readonly string[]
  locale?: Locale
}>()

const linkAttrs = computed(() => {
  if (!href) return { 'aria-disabled': 'true' as const }
  return newTab ? { href, target: '_blank', rel: 'noopener' } : { href }
})

const hasTags = computed(() => pills.length > 0)
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    v-bind="linkAttrs"
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
      <ExploreKindTag v-if="kind" :kind :locale />
      <WorkshopCardMark
        v-if="source"
        :label="source"
        :logo
        data-testid="explore-source"
      />
    </span>
    <span class="flex min-w-0 flex-col gap-2.5 px-3">
      <span class="truncate text-sm font-medium text-content-bright">
        {{ name }}
      </span>
      <span
        v-if="hasTags"
        class="flex min-w-0 flex-wrap items-center gap-1.5"
        data-testid="explore-pills"
      >
        <Badge v-for="pill in pills" :key="pill" variant="subtle">
          {{ pill }}
        </Badge>
      </span>
    </span>
  </component>
</template>
