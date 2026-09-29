<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import Badge from '../ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import type { FeaturedSlide } from './FeaturedBanner.vue'

const { slide, locale = 'en' } = defineProps<{
  slide: FeaturedSlide
  locale?: Locale
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <Badge
      variant="subtle"
      size="md"
      class="text-primary-comfy-canvas backdrop-blur-md"
    >
      {{ slide.kind }}
    </Badge>
    <Badge
      v-for="capability in slide.tags"
      :key="capability"
      variant="subtle"
      size="md"
      class="text-content-secondary backdrop-blur-md max-sm:hidden"
    >
      {{ capability }}
    </Badge>
  </div>

  <h2
    class="text-2xl font-bold text-balance text-primary-warm-white lg:text-3xl"
  >
    {{ slide.title }}
  </h2>

  <p
    v-if="slide.summary"
    class="line-clamp-2 max-w-prose shrink-0 text-content-secondary max-sm:line-clamp-1 short:hidden"
  >
    {{ slide.summary }}
  </p>

  <div class="pointer-events-auto flex w-fit items-center gap-3">
    <Button as="a" :href="slide.href" class="w-fit">
      {{ slide.cta ?? t('workshop.hub.tryNow', locale) }}
    </Button>
    <Button
      v-if="slide.docsHref"
      as="a"
      variant="outline"
      :href="slide.docsHref"
      target="_blank"
      rel="noopener noreferrer"
      class="w-fit"
      data-testid="featured-docs-link"
    >
      {{ t('workshop.hub.docs', locale) }}
    </Button>
  </div>
</template>
