<script setup lang="ts">
// PROTOTYPE VARIANT A — "Filter bar + featured lead".
// The hero is gone: a slim header plus a sticky category filter bar take its
// place, and the featured tutorial becomes a double-width lead card at the top
// of the grid (it follows the active filter).
import { computed, ref } from 'vue'

import type { Locale } from '../../../i18n/translations'
import type { CategoryFilter, PrototypeTutorial } from './prototypeData'

import { getTutorialPosterSrc } from '../../../data/learningTutorials'
import { t } from '../../../i18n/translations'
import Badge from '../../ui/badge/Badge.vue'
import { ButtonMask } from '../../ui/button-mask'
import TutorialDetailDialog from '../../learning/TutorialDetailDialog.vue'
import {
  categoryLabel,
  categoryOptions,
  featuredFor,
  filterByCategory
} from './prototypeData'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const category = defineModel<CategoryFilter>('category', { default: 'all' })

const featured = computed(() => featuredFor(category.value))
const rest = computed(() =>
  filterByCategory(category.value).filter(
    (tutorial) => tutorial.id !== featured.value?.id
  )
)
const total = computed(() => filterByCategory(category.value).length)

const activeTutorial = ref<PrototypeTutorial | null>(null)
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 pt-16 lg:pt-20">
    <header class="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p
          class="text-primary-comfy-yellow text-xs font-semibold tracking-widest uppercase"
        >
          Learning
        </p>
        <h1
          class="mt-3 text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
        >
          Tutorials &amp; workflows
        </h1>
      </div>
      <p class="text-primary-warm-gray text-sm">
        {{ total }} tutorial{{ total === 1 ? '' : 's' }}
      </p>
    </header>
  </section>

  <div
    class="sticky top-0 z-30 mt-10 border-y border-white/10 bg-primary-comfy-ink/85 backdrop-blur-md"
  >
    <nav
      class="max-w-9xl mx-auto flex scrollbar-none items-center gap-3 overflow-x-auto px-6 py-4"
      aria-label="Category filter"
    >
      <button
        v-for="option in categoryOptions"
        :key="option.value"
        type="button"
        :aria-pressed="category === option.value"
        class="shrink-0 cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors"
        :class="
          category === option.value
            ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
            : 'bg-transparency-white-t4 text-primary-warm-gray hover:text-primary-comfy-canvas'
        "
        @click="category = option.value"
      >
        {{ option.label }}
        <span class="ml-1 opacity-60">
          {{ filterByCategory(option.value).length }}
        </span>
      </button>
    </nav>
  </div>

  <section class="max-w-9xl mx-auto px-6 py-12 lg:py-16">
    <ul
      class="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-8"
    >
      <!-- Featured lead card -->
      <li v-if="featured" class="md:col-span-2">
        <button
          type="button"
          class="group relative block aspect-video w-full cursor-pointer overflow-hidden rounded-3xl text-left"
          :aria-label="`Featured: ${featured.title[locale]}`"
          @click="activeTutorial = featured"
        >
          <video
            :src="getTutorialPosterSrc(featured)"
            :poster="featured.poster"
            class="size-full object-cover"
            preload="metadata"
            playsinline
            muted
          ></video>
          <span
            class="absolute inset-0 bg-linear-to-t from-primary-comfy-ink/90 via-primary-comfy-ink/20 to-transparent"
            aria-hidden="true"
          />
          <span
            class="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 lg:p-8"
          >
            <span class="flex items-center gap-3">
              <Badge variant="accent">Featured</Badge>
              <Badge variant="category">
                {{ categoryLabel(featured.category) }}
              </Badge>
            </span>
            <span
              class="text-xl font-light text-primary-comfy-canvas lg:text-3xl"
            >
              {{ t('learning.tutorials.titlePrefix', locale) }}
              {{ featured.title[locale] }}
            </span>
          </span>
          <span
            class="absolute top-6 right-6 flex size-14 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm transition-transform group-hover:scale-105"
            aria-hidden="true"
          >
            <svg
              class="ml-1 size-5 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      </li>

      <!-- Regular cards -->
      <li
        v-for="tutorial in rest"
        :key="tutorial.id"
        class="bg-transparency-white-t4 flex flex-col gap-4 overflow-hidden rounded-3xl border-0 p-2"
      >
        <button
          type="button"
          class="group relative block aspect-video cursor-pointer overflow-hidden rounded-3xl"
          :aria-label="`${t('learning.tutorials.titlePrefix', locale)} ${tutorial.title[locale]}`"
          @click="activeTutorial = tutorial"
        >
          <video
            :src="getTutorialPosterSrc(tutorial)"
            :poster="tutorial.poster"
            class="size-full object-cover"
            preload="metadata"
            playsinline
            muted
          ></video>
          <span
            class="absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <span
              class="flex size-14 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm transition-transform group-hover:scale-105"
            >
              <svg
                class="ml-1 size-5 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>

        <div class="flex flex-col space-y-3 p-4">
          <Badge variant="category">
            {{ categoryLabel(tutorial.category) }}
          </Badge>
          <div class="flex items-center justify-between gap-4">
            <h3
              class="text-sm/snug text-primary-comfy-canvas lg:text-base/snug"
            >
              {{ t('learning.tutorials.titlePrefix', locale) }}<br />
              {{ tutorial.title[locale] }}
            </h3>
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
          </div>
          <ul class="flex flex-wrap gap-2">
            <li v-for="tag in tutorial.tags" :key="tag">
              <Badge>{{ t(tag, locale) }}</Badge>
            </li>
          </ul>
        </div>
      </li>
    </ul>

    <TutorialDetailDialog
      v-if="activeTutorial"
      :tutorial="activeTutorial"
      :locale="locale"
      @close="activeTutorial = null"
    />
  </section>
</template>
