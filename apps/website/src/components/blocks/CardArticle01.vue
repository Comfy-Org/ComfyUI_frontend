<script setup lang="ts">
import Badge from '../ui/badge/Badge.vue'

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
  description?: string
  media: CardArticleMedia
  cta: { label: string; href: string }
}

const { item, titleClamp = false } = defineProps<{
  item: CardArticleItem
  titleClamp?: boolean
}>()
</script>

<template>
  <Card class="group/pill-trigger relative h-full overflow-hidden">
    <a
      :href="item.cta.href"
      :aria-label="`${item.title} — ${item.cta.label}`"
      class="rounded-4.5xl focus-visible:ring-primary-comfy-yellow absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    />

    <div class="flex flex-col-reverse">
      <CardHeader class="gap-2 px-6">
        <Badge variant="category">
          {{ item.category }}
        </Badge>
        <CardTitle class="pt-4" :class="titleClamp ? 'truncate' : undefined">
          {{ item.title }}
        </CardTitle>
        <CardDescription v-if="item.description">
          {{ item.description }}
        </CardDescription>
      </CardHeader>

      <CardContent class="relative p-2">
        <div class="aspect-video w-full overflow-hidden rounded-4xl">
          <img
            v-if="item.media.type === 'image'"
            :src="item.media.src"
            :alt="item.media.alt"
            loading="lazy"
            decoding="async"
            class="size-full object-cover object-center transition-transform duration-500 ease-out group-hover/pill-trigger:scale-105"
          />
          <video
            v-else
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

    <CardFooter class="mt-auto px-6 pb-6">
      <ButtonPill as="span" variant="ghost" icon-position="left">
        {{ item.cta.label }}
      </ButtonPill>
    </CardFooter>
  </Card>
</template>
