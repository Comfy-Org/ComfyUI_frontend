<script setup lang="ts">
// Sidebar directory for /learning: a persistent left sidebar carries the page
// title and the category nav (with counts and blurbs), while the content
// column shows a compact featured banner followed by a dense, scannable row
// list. Each category is its own statically generated page; the nav entries
// are plain links that ClientRouter upgrades to client-side navigations, so
// Back/Forward walk through category selections and each page's SSR head
// keeps title and meta correct. `category` is undefined on /learning (all).
import { computed } from 'vue'

import type { LearningCategory } from '../../data/learningTutorials'
import type { Locale } from '../../i18n/translations'

import {
  featuredFor,
  filterByCategory,
  learningDescription,
  learningHeading
} from '../../data/learningTutorials'
import FeaturedTutorialCard from './FeaturedTutorialCard.vue'
import LearningCategoryNav from './LearningCategoryNav.vue'
import TutorialRow from './TutorialRow.vue'

const {
  locale = 'en',
  category,
  headingTag = 'h1'
} = defineProps<{
  locale?: Locale
  category?: LearningCategory
  /** Demote the sidebar heading on pages whose h1 lives elsewhere
   * (the tutorial dialog). */
  headingTag?: 'h1' | 'p'
}>()

const heading = computed(() => learningHeading(locale, category))
const description = computed(() => learningDescription(locale, category))

const featured = computed(() => featuredFor(category))
const rows = computed(() =>
  filterByCategory(category).filter(
    (tutorial) => tutorial.id !== featured.value?.id
  )
)
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-20">
    <div class="flex flex-col gap-10 lg:flex-row lg:gap-16">
      <!-- Sidebar -->
      <aside class="lg:w-72 lg:shrink-0">
        <div class="lg:sticky lg:top-10">
          <component
            :is="headingTag"
            class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-4xl"
          >
            {{ heading }}
          </component>
          <p class="text-primary-warm-gray mt-3 text-sm/relaxed">
            {{ description }}
          </p>

          <LearningCategoryNav :category="category" :locale="locale" />
        </div>
      </aside>

      <!-- Content column -->
      <div class="min-w-0 flex-1">
        <FeaturedTutorialCard
          v-if="featured"
          :tutorial="featured"
          :locale="locale"
        />

        <!-- Row list -->
        <ul class="mt-6 divide-y divide-white/10">
          <TutorialRow
            v-for="tutorial in rows"
            :key="tutorial.id"
            :tutorial="tutorial"
            :locale="locale"
          />
        </ul>
      </div>
    </div>
  </section>
</template>
