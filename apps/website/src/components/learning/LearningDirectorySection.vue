<script setup lang="ts">
// Sidebar directory for /learning: a persistent left sidebar carries the page
// title and the category nav (with counts and blurbs), while the content
// column shows a compact featured banner followed by a dense, scannable row
// list. Each category is its own statically generated page, so the nav
// entries are plain links; `category` is undefined on /learning (all).
import { computed } from 'vue'

import type { LearningCategory } from '../../data/learningTutorials'
import type { Locale, TranslationKey } from '../../i18n/translations'

import {
  categoryBlurbKeys,
  categoryLabelKeys,
  categoryPath,
  featuredFor,
  filterByCategory,
  populatedCategories
} from '../../data/learningTutorials'
import { localizeHref } from '../../config/routes'
import { t } from '../../i18n/translations'
import FeaturedTutorialCard from './FeaturedTutorialCard.vue'
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

interface NavOption {
  value?: LearningCategory
  labelKey: TranslationKey
  blurbKey: TranslationKey
  href: string
}

const navOptions: readonly NavOption[] = [
  {
    labelKey: 'learning.categories.all',
    blurbKey: 'learning.categories.all.blurb',
    href: '/learning'
  },
  ...populatedCategories.map((value) => ({
    value,
    labelKey: categoryLabelKeys[value],
    blurbKey: categoryBlurbKeys[value],
    href: categoryPath(value)
  }))
]

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
            {{ t('learning.title', locale) }}
          </component>
          <p class="text-primary-warm-gray mt-3 text-sm/relaxed">
            {{ t('learning.tagline', locale) }}
          </p>

          <nav
            class="mt-8 flex scrollbar-none gap-3 overflow-x-auto lg:flex-col lg:overflow-visible"
            :aria-label="t('learning.categoryNav', locale)"
          >
            <a
              v-for="option in navOptions"
              :key="option.value ?? 'all'"
              :href="localizeHref(option.href, locale)"
              :aria-current="category === option.value ? 'page' : undefined"
              class="shrink-0 rounded-xl px-4 py-3 text-left transition-colors lg:w-full"
              :class="
                category === option.value
                  ? 'lg:bg-primary-comfy-yellow bg-white/20 text-primary-comfy-canvas lg:text-primary-comfy-ink'
                  : 'bg-transparency-white-t4 text-primary-comfy-canvas hover:bg-white/10'
              "
            >
              <span class="flex items-baseline justify-between gap-6">
                <span class="text-xs font-semibold tracking-wide uppercase">
                  {{ t(option.labelKey, locale) }}
                </span>
                <span
                  class="text-xs tabular-nums"
                  :class="
                    category === option.value
                      ? 'text-primary-comfy-canvas/70 lg:text-primary-comfy-ink/70'
                      : 'text-primary-warm-gray'
                  "
                >
                  {{ filterByCategory(option.value).length }}
                </span>
              </span>
              <span
                class="mt-1 hidden text-[11px]/snug lg:block"
                :class="
                  category === option.value
                    ? 'text-primary-comfy-ink/70'
                    : 'text-primary-warm-gray'
                "
              >
                {{ t(option.blurbKey, locale) }}
              </span>
            </a>
          </nav>
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
