<script setup lang="ts">
// Category nav for the learning directory sidebar: an "All" entry followed by
// each populated category, with per-category tutorial counts and (on lg+)
// blurbs. Entries are plain links to the statically generated category pages;
// ClientRouter upgrades clicks to history-aware client-side navigations. The
// active entry is derived from `category`.
import type { LearningCategory } from '../../data/learningTutorials'
import type { Locale, TranslationKey } from '../../i18n/translations'

import {
  categoryBlurbKeys,
  categoryLabelKeys,
  categoryPath,
  filterByCategory,
  populatedCategories
} from '../../data/learningTutorials'
import { localizeHref } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en', category } = defineProps<{
  locale?: Locale
  category?: LearningCategory
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
</script>

<template>
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
</template>
