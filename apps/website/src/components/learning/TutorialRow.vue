<script setup lang="ts">
// A single row in the dense learning directory list: compact poster with the
// play overlay, category badge, title, tags, and a try-workflow CTA.
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
  <li
    class="group/row flex flex-wrap items-center gap-4 py-5 md:flex-nowrap md:gap-6"
  >
    <a
      :href="localizeHref(tutorialPath(tutorial), locale)"
      class="group/thumb relative block aspect-video w-full shrink-0 overflow-hidden rounded-2xl md:w-36 lg:w-44"
      :aria-label="`${t('player.play', locale)} ${tutorial.title[locale]}`"
    >
      <img
        :src="tutorial.poster"
        alt=""
        loading="lazy"
        class="size-full object-cover"
      />
      <PlayOverlay size="sm" class="text-white" />
    </a>

    <div class="w-full min-w-0 md:w-auto md:flex-1">
      <Badge variant="category" size="xs">
        {{ t(categoryLabelKeys[tutorial.category], locale) }}
      </Badge>
      <h3 class="mt-1 text-sm/snug text-primary-comfy-canvas lg:text-base/snug">
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

    <ButtonPill
      v-if="tutorial.href"
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
  </li>
</template>
