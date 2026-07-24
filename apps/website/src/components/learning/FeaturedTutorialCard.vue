<script setup lang="ts">
// The prominent featured banner at the top of the learning directory: a large
// poster with the play overlay beside the title, tags, and a try-workflow CTA.
import type { LearningTutorial } from '../../data/learningTutorials'
import type { Locale } from '../../i18n/translations'

import { categoryLabelKeys, tutorialPath } from '../../data/learningTutorials'
import { localizeHref } from '../../config/routes'
import { t } from '../../i18n/translations'
import Badge from '../ui/badge/Badge.vue'
import ButtonPill from '../ui/button-pill/ButtonPill.vue'
import PlayOverlay from './PlayOverlay.vue'

const { tutorial, locale = 'en' } = defineProps<{
  tutorial: LearningTutorial
  locale?: Locale
}>()
</script>

<template>
  <article
    class="bg-transparency-white-t4 rounded-4.5xl grid items-center gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10 lg:p-8"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <Badge variant="accent">
          {{ t('learning.featuredBadge', locale) }}
        </Badge>
        <Badge variant="category">
          {{ t(categoryLabelKeys[tutorial.category], locale) }}
        </Badge>
      </div>
      <h2
        class="text-2xl font-light tracking-tight text-primary-comfy-canvas lg:text-3xl"
      >
        <a
          :href="localizeHref(tutorialPath(tutorial), locale)"
          class="text-left hover:underline"
        >
          {{ t('learning.tutorials.titlePrefix', locale) }}
          {{ tutorial.title[locale] }}
        </a>
      </h2>
      <ul class="flex flex-wrap gap-2">
        <li v-for="tag in tutorial.tags" :key="tag">
          <Badge variant="subtle">{{ t(tag, locale) }}</Badge>
        </li>
      </ul>
      <div v-if="tutorial.href">
        <ButtonPill
          as="a"
          :href="tutorial.href"
          :target="tutorial.newTab ? '_blank' : undefined"
          :rel="tutorial.newTab ? 'noopener noreferrer' : undefined"
          icon-position="right"
          variant="ghost"
          size="default"
          class="ps-0"
        >
          {{ t('cta.tryWorkflow', locale) }}
        </ButtonPill>
      </div>
    </div>

    <a
      :href="localizeHref(tutorialPath(tutorial), locale)"
      class="group relative block aspect-video overflow-hidden rounded-3xl"
      :aria-label="`${t('player.play', locale)} ${tutorial.title[locale]}`"
    >
      <img
        :src="tutorial.poster"
        alt=""
        loading="lazy"
        decoding="async"
        class="size-full object-cover"
      />
      <PlayOverlay class="text-white" />
    </a>
  </article>
</template>
