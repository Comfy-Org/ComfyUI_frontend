<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import GlassCard from '../common/GlassCard.vue'
import InlineCodeText from '../common/InlineCodeText.vue'
import SectionHeader from '../common/SectionHeader.vue'
import VideoPlayer from '../common/VideoPlayer.vue'
import type { VideoTrack } from '../common/VideoPlayer.vue'

type RowMedia =
  | { type: 'image'; src: string; alt?: string; fit?: 'cover' | 'contain' }
  | {
      type: 'video'
      src: string
      // <video> has no native alt; used as the player's accessible label.
      alt?: string
      poster?: string
      tracks?: readonly VideoTrack[]
      autoplay?: boolean
      loop?: boolean
      minimal?: boolean
      hideControls?: boolean
      fit?: 'cover' | 'contain'
    }

export interface FeatureRow {
  id: string
  title: string
  description: string
  media: RowMedia
}

const {
  heading,
  eyebrow,
  locale = 'en',
  rows,
  titleClass
} = defineProps<{
  heading?: string
  eyebrow?: string
  locale?: Locale
  rows: readonly FeatureRow[]
  titleClass?: string
}>()

// Rows alternate which side the media sits on from lg up.
function textOrder(index: number): string {
  return index % 2 === 0 ? 'lg:order-1' : 'lg:order-2'
}

function mediaOrder(index: number): string {
  return index % 2 === 0 ? 'lg:order-2' : 'lg:order-1'
}

function mediaLabel(row: FeatureRow): string {
  return row.media.alt ?? row.title
}
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-16 lg:py-24">
    <SectionHeader v-if="heading" :label="eyebrow" max-width="xl">
      {{ heading }}
    </SectionHeader>

    <div v-if="$slots.media" class="mt-12 lg:mt-16">
      <slot name="media" />
    </div>

    <div :class="cn('flex flex-col gap-4 lg:gap-6', heading && 'mt-16')">
      <GlassCard
        v-for="(row, i) in rows"
        :key="row.id"
        class="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-0"
      >
        <!-- Text -->
        <div
          :class="
            cn(
              'order-2 flex flex-col justify-center gap-4 p-6 lg:flex-1 lg:p-12',
              textOrder(i)
            )
          "
        >
          <h3
            :class="
              cn(
                'text-2xl font-light text-primary-comfy-canvas lg:text-3xl',
                titleClass
              )
            "
          >
            {{ row.title }}
          </h3>
          <p class="text-sm text-pretty text-smoke-700 lg:text-base">
            <InlineCodeText :text="row.description" />
          </p>
        </div>

        <!-- Media: image or video -->
        <!-- 620/364 and w-155 (620px) match the card media asset dimensions -->
        <div
          :class="
            cn(
              'relative order-1 aspect-620/364 w-full lg:w-155 lg:shrink-0',
              mediaOrder(i)
            )
          "
        >
          <img
            v-if="row.media.type === 'image'"
            :src="row.media.src"
            :alt="mediaLabel(row)"
            loading="lazy"
            decoding="async"
            :class="
              cn(
                'absolute inset-0 size-full rounded-4xl',
                row.media.fit === 'contain' ? 'object-contain' : 'object-cover'
              )
            "
          />
          <VideoPlayer
            v-else
            :locale="locale"
            :aria-label="mediaLabel(row)"
            :src="row.media.src"
            :poster="row.media.poster"
            :tracks="row.media.tracks"
            :autoplay="row.media.autoplay"
            :loop="row.media.loop"
            :minimal="row.media.minimal"
            :hide-controls="row.media.hideControls"
            :fit="row.media.fit"
            :class="
              cn(
                'absolute inset-0 size-full',
                row.media.fit === 'contain' && 'bg-transparent'
              )
            "
          />
        </div>
      </GlassCard>
    </div>
  </section>
</template>
