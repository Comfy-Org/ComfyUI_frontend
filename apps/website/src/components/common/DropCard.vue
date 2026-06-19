<script setup lang="ts">
import type { Drop } from '../../data/drops'
import type { Locale } from '../../i18n/translations'

import Button from '../ui/button/Button.vue'
import Card from '../ui/card/Card.vue'
import CardContent from '../ui/card/CardContent.vue'
import CardFooter from '../ui/card/CardFooter.vue'
import CardHeader from '../ui/card/CardHeader.vue'

const { drop, locale } = defineProps<{
  drop: Drop
  locale: Locale
}>()
</script>

<template>
  <Card class="overflow-hidden">
    <CardHeader class="p-0">
      <div class="relative">
        <img
          :src="drop.image.src"
          :alt="drop.image.alt[locale]"
          loading="lazy"
          decoding="async"
          class="aspect-video w-full object-cover"
        />
        <span
          v-if="drop.badge"
          class="bg-primary-comfy-yellow absolute top-3 left-3 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-comfy-ink uppercase"
        >
          {{ drop.badge[locale] }}
        </span>
      </div>
    </CardHeader>

    <CardContent class="flex flex-col gap-2 px-6">
      <p
        class="text-xs font-medium tracking-wider text-primary-comfy-canvas/70 uppercase"
      >
        {{ drop.category[locale] }}
      </p>
      <h3
        class="text-primary-warm-white line-clamp-1 text-lg font-semibold tracking-tight"
      >
        {{ drop.title[locale] }}
      </h3>
      <p class="text-sm/relaxed text-primary-comfy-canvas/80">
        {{ drop.description[locale] }}
      </p>
    </CardContent>

    <CardFooter class="px-6 pb-6">
      <Button as="a" :href="drop.cta.href[locale]" variant="link">
        {{ drop.cta.label[locale] }}
      </Button>
    </CardFooter>
  </Card>
</template>
