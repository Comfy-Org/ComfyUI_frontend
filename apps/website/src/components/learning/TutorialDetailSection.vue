<script setup lang="ts">
// Dedicated tutorial page body: breadcrumb, title, the video player, a
// description, tags, the workflow CTA, and links to sibling tutorials. Rendered
// server-side (indexable HTML) and hydrated so the player is interactive.
import { computed } from 'vue'

import type { LearningTutorial } from '../../data/learningTutorials'
import type { Locale } from '../../i18n/translations'

import { localizeHref } from '../../config/routes'
import {
  categoryLabelKeys,
  filterByCategory,
  tutorialDescription,
  tutorialPath
} from '../../data/learningTutorials'
import { t } from '../../i18n/translations'
import Badge from '../ui/badge/Badge.vue'
import ButtonPill from '../ui/button-pill/ButtonPill.vue'
import VideoPlayer from '../common/VideoPlayer.vue'

const { tutorial, locale = 'en' } = defineProps<{
  tutorial: LearningTutorial
  locale?: Locale
}>()

const categoryLabel = computed(() =>
  t(categoryLabelKeys[tutorial.category], locale)
)

const crumbs = computed(() => [
  { name: t('breadcrumb.home', locale), href: '/' },
  { name: t('learning.title', locale), href: '/learning' },
  { name: categoryLabel.value, href: `/learning/${tutorial.category}` }
])

const description = computed(() => tutorialDescription(tutorial, locale))

const related = computed(() =>
  filterByCategory(tutorial.category).filter((item) => item.id !== tutorial.id)
)
</script>

<template>
  <section class="mx-auto max-w-5xl px-6 py-12 lg:py-16">
    <nav
      class="text-primary-warm-gray flex flex-wrap items-center gap-2 text-xs"
      :aria-label="t('learning.breadcrumb', locale)"
    >
      <template v-for="crumb in crumbs" :key="crumb.href">
        <a
          :href="localizeHref(crumb.href, locale)"
          class="transition-colors hover:text-primary-comfy-canvas"
        >
          {{ crumb.name }}
        </a>
        <span aria-hidden="true">/</span>
      </template>
      <span class="text-primary-comfy-canvas">{{
        tutorial.title[locale]
      }}</span>
    </nav>

    <div class="mt-6 flex items-center gap-3">
      <Badge variant="category">{{ categoryLabel }}</Badge>
    </div>

    <h1
      class="mt-4 text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-4xl"
    >
      {{ tutorial.title[locale] }}
    </h1>

    <p class="text-primary-warm-gray mt-4 max-w-2xl text-sm/relaxed">
      {{ description }}
    </p>

    <div
      class="rounded-4.5xl border-primary-comfy-yellow/60 mt-8 overflow-hidden border bg-black"
    >
      <VideoPlayer
        :locale="locale"
        :src="tutorial.videoSrc"
        :poster="tutorial.poster"
        :tracks="tutorial.caption"
        fit="contain"
        :aria-label="tutorial.title[locale]"
        class="aspect-video w-full"
      />
    </div>

    <div class="mt-6 flex flex-wrap items-center gap-4">
      <ButtonPill
        v-if="tutorial.href"
        as="a"
        :href="tutorial.href"
        icon-position="right"
        variant="ghost"
        size="default"
      >
        {{ t('cta.tryWorkflow', locale) }}
      </ButtonPill>
    </div>

    <ul v-if="tutorial.tags.length" class="mt-6 flex flex-wrap gap-2">
      <li v-for="tag in tutorial.tags" :key="tag">
        <Badge variant="subtle">{{ t(tag, locale) }}</Badge>
      </li>
    </ul>

    <div v-if="related.length" class="mt-14">
      <h2 class="text-lg font-light text-primary-comfy-canvas">
        {{ t('learning.detail.moreInCategory', locale) }} {{ categoryLabel }}
      </h2>
      <ul class="mt-4 grid gap-3 sm:grid-cols-2">
        <li v-for="item in related" :key="item.id">
          <a
            :href="localizeHref(tutorialPath(item), locale)"
            class="bg-transparency-white-t4 flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-white/10"
          >
            <span class="text-sm/snug text-primary-comfy-canvas">
              {{ item.title[locale] }}
            </span>
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>
