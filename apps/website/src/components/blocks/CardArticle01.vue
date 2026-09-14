<script setup lang="ts">
import Badge from '../ui/badge/Badge.vue'

import { resolveRel } from '../../utils/cta'
import CardArrow from '../common/CardArrow.vue'
import ButtonPill from '../ui/button-pill/ButtonPill.vue'
import Card from '../ui/card/Card.vue'
import CardContent from '../ui/card/CardContent.vue'
import CardDescription from '../ui/card/CardDescription.vue'
import CardFooter from '../ui/card/CardFooter.vue'
import CardHeader from '../ui/card/CardHeader.vue'
import CardTitle from '../ui/card/CardTitle.vue'

type CardArticleMedia = {
  type: 'image' | 'video'
  src: string
  alt: string
  poster?: string
}

export type CardArticleItem = {
  id: string
  badge?: string
  category: string
  title: string
  /** Small muted line under the title, e.g. an event date. */
  date?: string
  description?: string
  media?: CardArticleMedia
  author?: { name: string; avatarSrc: string }
  /** Without one the card is informational: no overlay link, no footer pill. */
  cta?: { label: string; href: string; newTab?: boolean }
}

const { item, titleClamp = false } = defineProps<{
  item: CardArticleItem
  titleClamp?: boolean
}>()

// Stand-in art for items with no media, in the brand plum family the site's
// banners and hero glows already use. Picked by a hash of the item id so the
// choice is stable across build and hydration, and neighbouring artless cards
// don't repeat.
const FALLBACK_GRADIENTS = [
  'radial-gradient(ellipse 70% 80% at 25% 20%, color-mix(in srgb, var(--color-primary-comfy-yellow) 30%, transparent), transparent 60%), linear-gradient(135deg, var(--color-primary-comfy-plum), var(--color-secondary-deep-plum) 60%, var(--color-primary-comfy-ink-light))',
  'radial-gradient(ellipse 80% 100% at 85% 10%, color-mix(in srgb, var(--color-primary-comfy-plum) 65%, transparent), transparent 65%), linear-gradient(200deg, var(--color-secondary-mauve), var(--color-secondary-deep-plum) 70%)',
  'radial-gradient(ellipse 90% 80% at 80% 90%, color-mix(in srgb, var(--color-primary-comfy-orange) 22%, transparent), transparent 60%), linear-gradient(160deg, var(--color-secondary-deep-plum), var(--color-primary-comfy-ink-light) 75%)',
  'radial-gradient(ellipse 100% 90% at 20% 85%, color-mix(in srgb, var(--color-illustration-forest) 75%, transparent), transparent 70%), linear-gradient(120deg, var(--color-secondary-deep-plum), var(--color-secondary-mauve))'
]

function fallbackGradient(id: string): string {
  const hash = [...id].reduce(
    (acc, char) => (acc * 31 + char.charCodeAt(0)) | 0,
    7
  )
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length]
}
</script>

<template>
  <Card class="group group/pill-trigger relative h-full overflow-hidden">
    <a
      v-if="item.cta"
      :href="item.cta.href"
      :target="item.cta.newTab ? '_blank' : undefined"
      :rel="resolveRel({ target: item.cta.newTab ? '_blank' : undefined })"
      :aria-label="`${item.title} — ${item.cta.label}`"
      class="rounded-4.5xl focus-visible:ring-primary-comfy-yellow absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    />

    <div class="flex flex-col-reverse">
      <CardHeader class="gap-2 px-6">
        <Badge variant="category">
          {{ item.category }}
        </Badge>
        <CardTitle
          class="pt-4"
          :class="titleClamp ? 'line-clamp-3' : undefined"
        >
          {{ item.title }}
        </CardTitle>
        <p
          v-if="item.date"
          class="text-xs font-light text-primary-comfy-canvas/60"
        >
          {{ item.date }}
        </p>
        <CardDescription v-if="item.description">
          {{ item.description }}
        </CardDescription>
      </CardHeader>

      <CardContent class="relative p-2">
        <div class="aspect-video w-full overflow-hidden rounded-4xl">
          <img
            v-if="item.media?.type === 'image'"
            :src="item.media.src"
            :alt="item.media.alt"
            loading="lazy"
            decoding="async"
            class="size-full object-cover object-center transition-transform duration-500 ease-out group-hover/pill-trigger:scale-105"
          />
          <video
            v-else-if="item.media"
            :src="item.media.src"
            :poster="item.media.poster"
            :aria-label="item.media.alt"
            autoplay
            loop
            muted
            playsinline
            preload="metadata"
            class="size-full object-cover object-center transition-transform duration-500 ease-out group-hover/pill-trigger:scale-105"
          />
          <div
            v-else
            aria-hidden="true"
            class="size-full transition-transform duration-500 ease-out group-hover/pill-trigger:scale-105"
            :style="{ background: fallbackGradient(item.id) }"
          />
        </div>
        <Badge
          v-if="item.badge"
          size="xs"
          variant="accent"
          class="absolute top-6 left-8"
        >
          {{ item.badge }}
        </Badge>
      </CardContent>
    </div>

    <CardFooter
      v-if="item.author"
      class="mt-auto items-center justify-between gap-4 px-6 pb-6"
    >
      <span class="flex min-w-0 items-center gap-3">
        <img
          :src="item.author.avatarSrc"
          alt=""
          loading="lazy"
          decoding="async"
          class="size-8 shrink-0 rounded-full object-cover"
        />
        <span class="truncate text-sm font-semibold text-primary-warm-white">
          {{ item.author.name }}
        </span>
      </span>
      <CardArrow
        v-if="item.cta"
        hover="group"
        class="size-8 shrink-0 rounded-xl bg-primary-warm-gray text-primary-warm-white"
      />
    </CardFooter>
    <CardFooter v-else-if="item.cta" class="mt-auto px-6 pb-6">
      <ButtonPill as="span" variant="ghost" icon-position="left">
        {{ item.cta.label }}
      </ButtonPill>
    </CardFooter>
  </Card>
</template>
