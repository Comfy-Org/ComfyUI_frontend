<script setup lang="ts">
import type { Drop } from '../../data/drops'
import type { Locale } from '../../i18n/translations'
import Badge from '../ui/badge/Badge.vue'

import ButtonPill from '../ui/button-pill/ButtonPill.vue'
import Card from '../ui/card/Card.vue'
import CardDescription from '../ui/card/CardDescription.vue'
import CardFooter from '../ui/card/CardFooter.vue'
import CardHeader from '../ui/card/CardHeader.vue'
import CardTitle from '../ui/card/CardTitle.vue'

const { drop, locale } = defineProps<{
  drop: Drop
  locale: Locale
}>()
</script>

<template>
  <Card class="overflow-hidden">
    <div class="relative p-2">
      <img
        :src="drop.image.src"
        :alt="drop.image.alt[locale]"
        loading="lazy"
        decoding="async"
        class="aspect-video w-full overflow-hidden rounded-4xl object-cover"
      />
      <Badge v-if="drop.badge" variant="accent" class="absolute top-6 left-8">
        {{ drop.badge[locale] }}
      </Badge>
    </div>

    <CardHeader class="gap-2 px-6">
      <Badge variant="ghost">
        {{ drop.category[locale] }}
      </Badge>
      <CardTitle class="pt-4">
        {{ drop.title[locale] }}
      </CardTitle>
      <CardDescription>
        {{ drop.description[locale] }}
      </CardDescription>
    </CardHeader>

    <CardFooter class="px-6 pb-6">
      <ButtonPill
        as="a"
        :href="drop.cta.href[locale]"
        variant="ghost"
        icon-position="left"
      >
        {{ drop.cta.label[locale] }}
      </ButtonPill>
    </CardFooter>
  </Card>
</template>
