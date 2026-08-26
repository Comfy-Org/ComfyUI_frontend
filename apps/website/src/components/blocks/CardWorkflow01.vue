<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronRight } from '@lucide/vue'

import type { AnchorHTMLAttributes, HTMLAttributes } from 'vue'

import { resolveRel } from '../../utils/cta'
import Badge from '../ui/badge/Badge.vue'
import type { BadgeVariants } from '../ui/badge'

type CardWorkflowMedia =
  | {
      type: 'image'
      src: string
      alt: string
    }
  | {
      type: 'video'
      src: string
      alt: string
      poster?: string
    }
  | {
      type: 'placeholder'
      alt: string
    }

export type CardWorkflowItem = {
  id: string
  title: string
  href?: string
  target?: AnchorHTMLAttributes['target']
  media: CardWorkflowMedia
  description?: string
  sourceLabel?: string
  brandIconSrc?: string
  statusBadges?: readonly CardWorkflowStatusBadge[]
  tags?: readonly string[]
}

type CardWorkflowStatusBadge = {
  type: 'day-zero' | 'open-weights'
  label: string
}

function getStatusBadgeVariant(
  status: CardWorkflowStatusBadge
): BadgeVariants['variant'] {
  return status.type === 'day-zero' ? 'accent' : 'callout'
}

const {
  item,
  variant = 'default',
  statusBadgePlacement = 'content',
  class: className
} = defineProps<{
  item: CardWorkflowItem
  // 'compact' is the featured-projects grid card: tighter paddings, a
  // single-line 14px title, and sentence-case tag badges.
  variant?: 'default' | 'compact' | 'showcase' | 'feature'
  statusBadgePlacement?: 'content' | 'featured-media'
  class?: HTMLAttributes['class']
}>()

function linkTarget(item: CardWorkflowItem): AnchorHTMLAttributes['target'] {
  return item.target ?? '_blank'
}
</script>

<template>
  <div
    :class="
      cn(
        'bg-transparency-white-t4 group relative flex flex-col',
        variant === 'default'
          ? 'rounded-4.5xl px-2 pt-2 pb-8'
          : 'rounded-5xl gap-4 p-2',
        item.href &&
          'transition-colors duration-200 hover:bg-transparency-white-t8',
        className
      )
    "
  >
    <a
      v-if="item.href"
      :href="item.href"
      :target="linkTarget(item)"
      :rel="resolveRel({ target: linkTarget(item) })"
      :aria-label="item.title"
      class="focus-visible:ring-primary-comfy-yellow absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      :class="variant === 'default' ? 'rounded-4.5xl' : 'rounded-5xl'"
    />

    <div
      :class="
        cn(
          'bg-transparency-white-t4 relative overflow-hidden',
          variant === 'feature'
            ? 'aspect-video rounded-4xl'
            : 'aspect-4/3 rounded-[2.25rem]'
        )
      "
    >
      <img
        v-if="item.media.type === 'image'"
        :src="item.media.src"
        :alt="item.media.alt"
        loading="lazy"
        decoding="async"
        class="size-full object-cover"
      />
      <video
        v-else-if="item.media.type === 'video'"
        :src="item.media.src"
        :poster="item.media.poster"
        :aria-label="item.media.alt"
        autoplay
        loop
        muted
        playsinline
        preload="metadata"
        class="size-full object-cover"
      />
      <slot v-else name="media" />
      <div
        v-if="variant === 'compact'"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 bg-linear-to-b from-black/24 to-transparent"
      />
      <div
        v-else-if="variant === 'showcase'"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent"
      />
      <div
        v-else-if="variant === 'feature'"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 bg-linear-to-b from-black/35 via-black/5 to-transparent"
      />
      <h3
        v-if="variant === 'showcase'"
        class="absolute inset-x-5 bottom-5 line-clamp-2 text-2xl leading-[1.15] font-normal text-white"
      >
        {{ item.title }}
      </h3>
      <h3
        v-else-if="variant === 'feature'"
        class="absolute top-6 right-24 left-6 line-clamp-2 text-2xl leading-[1.2] font-normal text-white lg:text-3xl"
      >
        {{ item.title }}
      </h3>
      <div
        v-if="variant === 'feature' && item.brandIconSrc"
        data-slot="workflow-brand"
        class="absolute top-6 right-6 flex size-16 items-center justify-center rounded-full bg-transparency-white-t20 p-4 backdrop-blur-sm"
      >
        <img :src="item.brandIconSrc" alt="" class="size-full" />
      </div>
      <div
        v-if="
          statusBadgePlacement === 'featured-media' && item.statusBadges?.length
        "
        data-slot="workflow-status-badges"
        data-placement="featured-media"
        class="absolute top-6 left-6 flex flex-wrap items-center gap-2"
      >
        <Badge
          v-for="status in item.statusBadges"
          :key="status.type"
          :variant="getStatusBadgeVariant(status)"
          size="feature"
        >
          {{ status.label }}
        </Badge>
      </div>
    </div>

    <div
      class="flex grow flex-col"
      :class="variant === 'default' ? 'px-6 pt-6' : 'gap-5 px-4 pb-2'"
    >
      <h3
        v-if="variant !== 'showcase' && variant !== 'feature'"
        :class="
          variant === 'compact'
            ? 'w-full truncate text-sm leading-[1.2] font-semibold text-primary-comfy-canvas/95'
            : 'text-2xl leading-[1.4] font-medium text-primary-comfy-canvas'
        "
      >
        {{ item.title }}
      </h3>
      <div
        v-if="
          (variant === 'showcase' || variant === 'feature') && item.sourceLabel
        "
        data-slot="workflow-source"
        class="flex items-center justify-between gap-4"
      >
        <span class="flex min-w-0 items-center gap-2.5">
          <img
            src="/icons/comfyicon.svg"
            alt=""
            class="size-7 shrink-0 rounded-full"
          />
          <span class="truncate text-lg text-primary-comfy-canvas/75">
            {{ item.sourceLabel }}
          </span>
        </span>
        <span
          aria-hidden="true"
          :class="
            cn(
              'flex shrink-0 items-center justify-center rounded-full transition-colors duration-200',
              variant === 'feature'
                ? 'bg-primary-comfy-yellow size-8 text-primary-comfy-ink group-hover:bg-primary-comfy-canvas'
                : 'group-hover:bg-primary-comfy-yellow size-11 bg-transparency-white-t20 text-primary-comfy-canvas group-hover:text-primary-comfy-ink'
            )
          "
        >
          <ChevronRight class="size-5" />
        </span>
      </div>
      <p
        v-if="item.description"
        class="text-sm leading-[1.6] font-light text-primary-comfy-canvas"
        :class="variant === 'compact' ? undefined : 'mt-4'"
      >
        {{ item.description }}
      </p>
      <div
        v-if="
          (statusBadgePlacement === 'content' && item.statusBadges?.length) ||
          item.tags?.length
        "
        class="flex min-w-0 flex-wrap items-center"
        :class="variant === 'default' ? 'mt-auto gap-1.5 pt-6' : 'gap-2'"
      >
        <Badge
          v-for="status in statusBadgePlacement === 'content'
            ? item.statusBadges
            : []"
          :key="status.type"
          :variant="getStatusBadgeVariant(status)"
          size="md"
        >
          {{ status.label }}
        </Badge>
        <Badge
          v-for="tag in item.tags"
          :key="tag"
          variant="subtle"
          size="card"
          :class="variant === 'default' ? 'uppercase' : 'font-normal'"
        >
          {{ tag }}
        </Badge>
      </div>
    </div>
  </div>
</template>
