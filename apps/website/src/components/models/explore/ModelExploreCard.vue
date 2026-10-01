<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { AnchorHTMLAttributes } from 'vue'

import Badge from '../../ui/badge/Badge.vue'
import { resolveRel } from '../../../utils/cta'

export interface CardWorkflowItem {
  id: string
  title: string
  href: string
  target?: AnchorHTMLAttributes['target']
  description?: string
  sourceLabel?: string
  brandIconSrc?: string
  tags?: readonly string[]
  statusBadges?: readonly { type: 'open-weights'; label: string }[]
  media:
    | { type: 'image'; src: string; alt: string }
    | { type: 'placeholder'; alt: string }
}

const { item, variant = 'compact' } = defineProps<{
  item: CardWorkflowItem
  variant?: 'compact' | 'feature'
}>()
</script>

<template>
  <a
    :href="item.href"
    :target="item.target"
    :rel="resolveRel({ target: item.target })"
    :aria-label="item.title"
    class="group flex h-full min-w-0 flex-col gap-4 rounded-5xl bg-transparency-white-t4 p-2 transition-colors hover:bg-transparency-white-t8 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow focus-visible:outline-none"
  >
    <div
      :class="
        cn(
          'relative overflow-hidden rounded-4.5xl bg-transparency-white-t4',
          variant === 'feature' ? 'aspect-video' : 'aspect-4/3'
        )
      "
    >
      <img
        v-if="item.media.type === 'image'"
        :src="item.media.src"
        :alt="item.media.alt"
        class="size-full object-cover"
        :loading="variant === 'feature' ? 'eager' : 'lazy'"
        decoding="async"
      />
      <slot v-else name="media" />
    </div>
    <div class="flex grow flex-col gap-3 px-4 pb-4">
      <h3
        :class="
          cn(
            'text-primary-comfy-canvas',
            variant === 'feature'
              ? 'text-2xl font-medium'
              : 'text-base font-semibold'
          )
        "
      >
        {{ item.title }}
      </h3>
      <p
        v-if="item.description"
        class="text-sm/relaxed font-light text-primary-comfy-canvas"
      >
        {{ item.description }}
      </p>
      <p v-if="item.sourceLabel" class="text-sm text-primary-warm-gray">
        {{ item.sourceLabel }}
      </p>
      <div class="mt-auto flex flex-wrap gap-2">
        <Badge
          v-for="status in item.statusBadges"
          :key="status.type"
          variant="callout"
          >{{ status.label }}</Badge
        >
        <Badge v-for="tag in item.tags" :key="tag" variant="subtle">{{
          tag
        }}</Badge>
      </div>
    </div>
  </a>
</template>
