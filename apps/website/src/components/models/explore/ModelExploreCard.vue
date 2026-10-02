<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import type { AnchorHTMLAttributes } from 'vue'

import Badge from '../../ui/badge/Badge.vue'
import ModelCardTags from './ModelCardTags.vue'
import WorkshopCardMark from '../../workshop/WorkshopCardMark.vue'
import { getLogoPath } from '../../../lib/hub/model-logos'
import { resolveRel } from '../../../utils/cta'

export interface CardWorkflowItem {
  id: string
  title: string
  href: string
  target?: AnchorHTMLAttributes['target']
  description?: string
  sourceLabel?: string
  taskLabel?: string
  capabilities?: readonly string[]
  provider?: string
  brandIconSrc?: string
  tags?: readonly string[]
  statusBadges?: readonly { type: 'open-weights'; label: string }[]
  media:
    | { type: 'image'; src: string; alt: string }
    | { type: 'placeholder'; alt: string }
}

const { item, variant = 'compact' } = defineProps<{
  item: CardWorkflowItem
  variant?: 'compact' | 'feature' | 'hub'
}>()

const compactStyles = {
  card: 'gap-4 rounded-5xl bg-transparency-white-t4 p-2 hover:bg-transparency-white-t8 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow',
  media: 'aspect-4/3 rounded-4.5xl bg-transparency-white-t4',
  body: 'px-4 pb-4',
  title: 'text-base font-semibold text-primary-comfy-canvas',
  description: 'text-sm/relaxed font-light text-primary-comfy-canvas',
  tags: 'flex-wrap gap-2',
  tag: ''
}
const hubStyles = {
  card: 'cursor-pointer gap-3 overflow-hidden rounded-3xl bg-hub-surface px-2 pt-2 pb-4 duration-200 hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
  media: 'aspect-4/3 rounded-2xl bg-hub-surface',
  body: 'px-3',
  title: 'truncate text-xs font-medium text-content-bright lg:text-sm',
  description: 'line-clamp-3 text-sm/relaxed font-light text-content-secondary',
  tags: 'h-6 min-w-0 items-center gap-1.5 overflow-hidden',
  tag: 'h-6 shrink-0 bg-hub-surface px-4 py-1 text-xs font-normal whitespace-nowrap text-content'
}
const variantStyles = {
  compact: compactStyles,
  hub: hubStyles,
  feature: {
    ...hubStyles,
    media: 'aspect-video rounded-2xl bg-hub-surface',
    title: 'text-2xl font-medium text-content-bright'
  }
}
const styles = computed(() => variantStyles[variant])
</script>

<template>
  <a
    :href="item.href"
    :target="item.target"
    :rel="resolveRel({ target: item.target })"
    :aria-label="item.title"
    :class="
      cn(
        'group flex h-full min-w-0 flex-col transition-colors focus-visible:outline-none',
        styles.card
      )
    "
  >
    <div :class="cn('relative overflow-hidden', styles.media)">
      <div
        v-if="item.statusBadges?.length"
        class="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap gap-2"
      >
        <Badge
          v-for="status in item.statusBadges"
          :key="status.type"
          variant="callout"
          >{{ status.label }}</Badge
        >
      </div>
      <WorkshopCardMark
        v-if="variant !== 'compact' && (item.provider || item.brandIconSrc)"
        :label="item.provider ?? item.title"
        :logo="item.brandIconSrc ?? getLogoPath(item.provider ?? item.title)"
      />
      <img
        v-if="item.media.type === 'image'"
        :src="item.media.src"
        :alt="item.media.alt"
        :class="
          cn(
            'size-full object-cover',
            variant !== 'compact' &&
              'transition-transform duration-300 group-hover:scale-105 group-focus-visible:scale-105 motion-reduce:scale-100'
          )
        "
        :loading="variant === 'feature' ? 'eager' : 'lazy'"
        decoding="async"
      />
      <slot v-else name="media" />
    </div>
    <div :class="cn('flex grow flex-col gap-3', styles.body)">
      <h3 :class="styles.title" :title="item.title">
        {{ item.title }}
      </h3>
      <p
        v-if="item.description"
        :class="styles.description"
        :title="item.description"
      >
        {{ item.description }}
      </p>
      <p v-if="item.sourceLabel" class="text-sm text-primary-warm-gray">
        {{ item.sourceLabel }}
      </p>
      <ModelCardTags :item :variant :styles />
    </div>
  </a>
</template>
