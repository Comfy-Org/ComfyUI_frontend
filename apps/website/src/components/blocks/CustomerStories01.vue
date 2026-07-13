<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { StoryCard as StoryCardType } from '../../utils/customers'
import SectionHeader from '../common/SectionHeader.vue'
import StoryCard from '../customers/StoryCard.vue'
import ScrollCarousel from '../ui/scroll-carousel/ScrollCarousel.vue'

const {
  stories,
  heading,
  subtitle,
  locale = 'en',
  class: className
} = defineProps<{
  stories: StoryCardType[]
  heading?: string
  subtitle?: string
  locale?: Locale
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section
    :class="cn('max-w-9xl mx-auto px-6 py-16 lg:px-16 lg:py-24', className)"
  >
    <SectionHeader v-if="heading" class="mb-12 lg:mb-16">
      {{ heading }}
      <template v-if="subtitle" #subtitle>
        <p class="mt-4 text-sm text-smoke-700 lg:text-base">
          {{ subtitle }}
        </p>
      </template>
    </SectionHeader>

    <!-- Reuse the shared carousel shell; neutralise its outer chrome so the
         section wrapper above owns the padding and max-width. -->
    <ScrollCarousel
      :locale="locale"
      gap-class="gap-6"
      class="max-w-none p-0 lg:p-0"
    >
      <StoryCard
        v-for="story in stories"
        :key="story.slug"
        :story="story"
        :locale="locale"
        class="w-[80%] shrink-0 snap-start sm:w-[70%] lg:w-[calc(50%-0.75rem)]"
      />
    </ScrollCarousel>
  </section>
</template>
