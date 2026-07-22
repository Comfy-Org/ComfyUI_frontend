<script setup lang="ts">
// Sidebar directory for /learning: a persistent left sidebar carries the page
// title and the category nav (with counts and blurbs), while the content
// column shows a compact featured banner followed by a dense, scannable row
// list. Each category is still its own statically generated page (for direct
// loads and crawlers), but on the directory pages the nav filters in place:
// once hydrated it swaps the featured banner and rows client-side and syncs
// the URL, so switching filters never reloads or jumps the page. `category` is
// undefined on /learning (all).
import { computed, ref } from 'vue'

import type { LearningCategory } from '../../data/learningTutorials'
import type { Locale } from '../../i18n/translations'

import { featuredFor, filterByCategory } from '../../data/learningTutorials'
import { t } from '../../i18n/translations'
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

// Only the primary directory pages filter in place; on the tutorial-dialog
// backdrop (headingTag 'p') the nav stays plain links that navigate away.
const filterInPlace = headingTag === 'h1'

const activeCategory = ref(category)

const featured = computed(() => featuredFor(activeCategory.value))
const rows = computed(() =>
  filterByCategory(activeCategory.value).filter(
    (tutorial) => tutorial.id !== featured.value?.id
  )
)

function selectCategory(value: LearningCategory | undefined, href: string) {
  activeCategory.value = value
  // Reflect the filter in the URL (preserving ClientRouter's history state) so
  // refresh, share, and deep links resolve to the matching static page.
  history.replaceState(history.state, '', href)
}
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
            {{ t('learning.title', locale) }}
          </component>
          <p class="text-primary-warm-gray mt-3 text-sm/relaxed">
            {{ t('learning.tagline', locale) }}
          </p>

          <LearningCategoryNav
            :category="activeCategory"
            :locale="locale"
            :interactive="filterInPlace"
            @select="selectCategory"
          />
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
