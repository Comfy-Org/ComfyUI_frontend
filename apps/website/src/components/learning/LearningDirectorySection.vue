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
  populatedCategories,
  tutorialPath
} from '../../data/learningTutorials'
import { localizeHref } from '../../config/routes'
import { t } from '../../i18n/translations'
import Badge from '../ui/badge/Badge.vue'
import { ButtonMask } from '../ui/button-mask'
import ButtonPill from '../ui/button-pill/ButtonPill.vue'
import PlayOverlay from './PlayOverlay.vue'

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
          <h1
            class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-4xl"
          >
            {{ t('learning.title', locale) }}
          </h1>
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
                  ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
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
                      ? 'text-primary-comfy-ink/70'
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
        <!-- Featured banner -->
        <article
          v-if="featured"
          class="bg-transparency-white-t4 rounded-4.5xl grid items-center gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10 lg:p-8"
        >
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3">
              <Badge variant="accent">
                {{ t('learning.featuredBadge', locale) }}
              </Badge>
              <Badge variant="category">
                {{ t(categoryLabelKeys[featured.category], locale) }}
              </Badge>
            </div>
            <h2
              class="text-2xl font-light tracking-tight text-primary-comfy-canvas lg:text-3xl"
            >
              <a
                :href="localizeHref(tutorialPath(featured), locale)"
                class="text-left hover:underline"
              >
                {{ t('learning.tutorials.titlePrefix', locale) }}
                {{ featured.title[locale] }}
              </a>
            </h2>
            <ul class="flex flex-wrap gap-2">
              <li v-for="tag in featured.tags" :key="tag">
                <Badge variant="subtle">{{ t(tag, locale) }}</Badge>
              </li>
            </ul>
            <div v-if="featured.href">
              <ButtonPill
                as="a"
                :href="featured.href"
                icon-position="right"
                variant="ghost"
                size="default"
              >
                {{ t('cta.tryWorkflow', locale) }}
              </ButtonPill>
            </div>
          </div>

          <a
            :href="localizeHref(tutorialPath(featured), locale)"
            class="group relative block aspect-video overflow-hidden rounded-3xl"
            :aria-label="`${t('player.play', locale)} ${featured.title[locale]}`"
          >
            <img :src="featured.poster" alt="" class="size-full object-cover" />
            <PlayOverlay class="text-white" />
          </a>
        </article>

        <!-- Row list -->
        <ul class="mt-6 divide-y divide-white/10">
          <li
            v-for="tutorial in rows"
            :key="tutorial.id"
            class="flex flex-wrap items-center gap-4 py-5 lg:flex-nowrap lg:gap-6"
          >
            <a
              :href="localizeHref(tutorialPath(tutorial), locale)"
              class="group relative block aspect-video w-36 shrink-0 overflow-hidden rounded-2xl lg:w-44"
              :aria-label="`${t('player.play', locale)} ${tutorial.title[locale]}`"
            >
              <img
                :src="tutorial.poster"
                alt=""
                loading="lazy"
                class="size-full object-cover"
              />
              <PlayOverlay
                size="sm"
                class="text-white opacity-0 transition-opacity group-hover:opacity-100"
              />
            </a>

            <div class="min-w-0 flex-1">
              <Badge variant="category" size="xs">
                {{ t(categoryLabelKeys[tutorial.category], locale) }}
              </Badge>
              <h3
                class="mt-1 text-sm/snug text-primary-comfy-canvas lg:text-base/snug"
              >
                <a
                  :href="localizeHref(tutorialPath(tutorial), locale)"
                  class="text-left hover:underline"
                >
                  {{ t('learning.tutorials.titlePrefix', locale) }}
                  {{ tutorial.title[locale] }}
                </a>
              </h3>
              <ul class="mt-2 flex flex-wrap gap-2">
                <li v-for="tag in tutorial.tags" :key="tag">
                  <Badge variant="subtle" size="xs">{{ t(tag, locale) }}</Badge>
                </li>
              </ul>
            </div>

            <ButtonMask
              v-if="tutorial.href"
              as="a"
              :href="tutorial.href"
              icon-position="right"
              class="shrink-0"
              variant="ghost"
              size="default"
            >
              {{ t('cta.tryWorkflow', locale) }}
              <template #icon>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-4"
                >
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </template>
            </ButtonMask>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
