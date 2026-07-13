<script setup lang="ts">
import type { Drop } from '../../data/drops'
import type { Locale } from '../../i18n/translations'
import Badge from '../../components/ui/badge/Badge.vue'

import ButtonPill from '../../components/ui/button-pill/ButtonPill.vue'
import Card from '../../components/ui/card/Card.vue'
import CardContent from '../../components/ui/card/CardContent.vue'
import CardDescription from '../../components/ui/card/CardDescription.vue'
import CardFooter from '../../components/ui/card/CardFooter.vue'
import CardHeader from '../../components/ui/card/CardHeader.vue'
import CardTitle from '../../components/ui/card/CardTitle.vue'

const { drop, locale } = defineProps<{
  drop: Drop
  locale: Locale
}>()
</script>

<template>
  <Card class="group/pill-trigger relative h-full overflow-hidden">
    <a
      :href="drop.cta.href[locale]"
      :aria-label="`${drop.title[locale]} — ${drop.cta.label[locale]}`"
      class="rounded-4.5xl focus-visible:ring-primary-comfy-yellow absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    />

    <div class="flex flex-col-reverse">
      <CardHeader class="gap-2 px-6">
        <Badge variant="category">
          {{ drop.category[locale] }}
        </Badge>
        <CardTitle class="pt-4">
          {{ drop.title[locale] }}
        </CardTitle>
        <CardDescription>
          {{ drop.description[locale] }}
        </CardDescription>
      </CardHeader>

      <CardContent class="relative p-2">
        <div class="aspect-video w-full overflow-hidden rounded-4xl">
          <img
            v-if="drop.media.type === 'image'"
            :src="drop.media.src"
            :alt="drop.media.alt[locale]"
            loading="lazy"
            decoding="async"
            class="size-full object-cover object-center transition-transform duration-500 ease-out group-hover/pill-trigger:scale-105"
          />
          <video
            v-else
            :src="drop.media.src"
            :poster="drop.media.poster"
            :aria-label="drop.media.alt[locale]"
            autoplay
            loop
            muted
            playsinline
            preload="metadata"
            class="size-full object-cover object-center transition-transform duration-500 ease-out group-hover/pill-trigger:scale-105"
          />
        </div>
        <Badge
          v-if="drop.badge"
          size="xs"
          variant="accent"
          class="absolute top-6 left-8"
        >
          {{ drop.badge[locale] }}
        </Badge>
      </CardContent>
    </div>

    <CardFooter class="mt-auto px-6 pb-6">
      <ButtonPill as="span" variant="ghost" icon-position="left">
        {{ drop.cta.label[locale] }}
      </ButtonPill>
    </CardFooter>
  </Card>
</template>
