<script setup lang="ts">
// PROTOTYPE VARIANT C — "Spotlight hero + category shelves".
// The hero earns its keep by merging with the featured element: headline on
// the left, featured video playing inline on the right. Below, one horizontal
// shelf per category (VFX / Animations / Ads); "View all" drills into a
// single-category grid — this is the shape that maps most directly onto
// /learning/vfx-style routes.
import { computed, ref } from 'vue'

import type { Locale } from '../../../i18n/translations'
import type { CategoryFilter, PrototypeTutorial } from './prototypeData'

import { getTutorialPosterSrc } from '../../../data/learningTutorials'
import { t } from '../../../i18n/translations'
import Badge from '../../ui/badge/Badge.vue'
import { ButtonMask } from '../../ui/button-mask'
import VideoPlayer from '../../common/VideoPlayer.vue'
import TutorialDetailDialog from '../../learning/TutorialDetailDialog.vue'
import {
  categoryLabel,
  featuredFor,
  filterByCategory,
  realCategories
} from './prototypeData'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const category = defineModel<CategoryFilter>('category', { default: 'all' })

const featured = computed(() => featuredFor('all'))
const drilledIn = computed(() => category.value !== 'all')
const drilledTutorials = computed(() => filterByCategory(category.value))
const drilledLabel = computed(() =>
  category.value === 'all' ? '' : categoryLabel(category.value)
)

const activeTutorial = ref<PrototypeTutorial | null>(null)
</script>

<template>
  <!-- Spotlight hero: headline + featured element merged -->
  <section class="max-w-9xl mx-auto px-6 pt-20 pb-8 lg:pt-24 lg:pb-12">
    <div class="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div class="flex flex-col gap-6">
        <h1
          class="text-3xl leading-[110%] font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
        >
          {{ t('learning.heroTitle.before', locale) }}
          <span class="text-primary-comfy-yellow">ComfyUI</span
          >{{ t('learning.heroTitle.after', locale) }}
          {{ t('learning.heroTitle.line2', locale) }}
        </h1>

        <div v-if="featured" class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <Badge variant="accent">Featured</Badge>
            <Badge variant="category">
              {{ categoryLabel(featured.category) }}
            </Badge>
          </div>
          <p class="text-sm/relaxed text-primary-comfy-canvas lg:text-base">
            {{ t('learning.tutorials.titlePrefix', locale) }}
            {{ featured.title[locale] }}
          </p>
          <div v-if="featured.href">
            <ButtonMask
              as="a"
              :href="featured.href"
              icon-position="right"
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
        </div>
      </div>

      <div
        v-if="featured"
        class="border-primary-warm-gray rounded-4.5xl border p-4"
      >
        <VideoPlayer
          :locale
          :src="featured.videoSrc"
          :poster="featured.poster"
          minimal
        />
      </div>
    </div>
  </section>

  <!-- Drilled-in single-category grid -->
  <section v-if="drilledIn" class="max-w-9xl mx-auto px-6 py-8 lg:py-12">
    <button
      type="button"
      class="text-primary-warm-gray flex cursor-pointer items-center gap-2 text-xs font-semibold tracking-wide uppercase transition-colors hover:text-primary-comfy-canvas"
      @click="category = 'all'"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-3"
        aria-hidden="true"
      >
        <polyline points="15 6 9 12 15 18" />
      </svg>
      All categories
    </button>

    <h2
      class="mt-4 mb-10 text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
    >
      {{ drilledLabel }}
      <span class="text-primary-warm-gray text-xl lg:text-3xl">
        — {{ drilledTutorials.length }} tutorial{{
          drilledTutorials.length === 1 ? '' : 's'
        }}
      </span>
    </h2>

    <ul
      class="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-8"
    >
      <li
        v-for="tutorial in drilledTutorials"
        :key="tutorial.id"
        class="bg-transparency-white-t4 flex flex-col gap-4 overflow-hidden rounded-3xl p-2"
      >
        <button
          type="button"
          class="group relative block aspect-video cursor-pointer overflow-hidden rounded-3xl"
          :aria-label="`Play ${tutorial.title[locale]}`"
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
        <div class="flex flex-col gap-2 p-4">
          <Badge variant="category">
            {{ categoryLabel(tutorial.category) }}
          </Badge>
          <h3 class="text-sm/snug text-primary-comfy-canvas lg:text-base/snug">
            {{ t('learning.tutorials.titlePrefix', locale) }}
            {{ tutorial.title[locale] }}
          </h3>
        </div>
      </li>
    </ul>
  </section>

  <!-- Category shelves -->
  <template v-else>
    <section
      v-for="option in realCategories"
      :key="option.value"
      class="max-w-9xl mx-auto px-6 py-8 lg:py-10"
    >
      <header class="mb-6 flex items-end justify-between gap-6">
        <div>
          <h2
            class="text-2xl font-light tracking-tight text-primary-comfy-canvas lg:text-4xl"
          >
            {{ option.label }}
          </h2>
          <p class="text-primary-warm-gray mt-1 text-sm">
            {{ option.blurb }}
          </p>
        </div>
        <button
          type="button"
          class="text-primary-comfy-yellow flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold tracking-wide uppercase transition-opacity hover:opacity-80"
          @click="category = option.value"
        >
          View all {{ filterByCategory(option.value).length }}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-3"
            aria-hidden="true"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
      </header>

      <ul
        class="flex snap-x scrollbar-none gap-6 overflow-x-auto pb-2 lg:gap-8"
      >
        <li
          v-for="tutorial in filterByCategory(option.value)"
          :key="tutorial.id"
          class="bg-transparency-white-t4 flex w-72 shrink-0 snap-start flex-col gap-3 overflow-hidden rounded-3xl p-2 lg:w-80"
        >
          <button
            type="button"
            class="group relative block aspect-video cursor-pointer overflow-hidden rounded-3xl"
            :aria-label="`Play ${tutorial.title[locale]}`"
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
                class="flex size-12 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm transition-transform group-hover:scale-105"
              >
                <svg
                  class="ml-0.5 size-4 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
          <div class="flex flex-col gap-2 p-3">
            <Badge variant="category" size="xs">
              {{ categoryLabel(tutorial.category) }}
            </Badge>
            <h3 class="text-sm/snug text-primary-comfy-canvas">
              {{ t('learning.tutorials.titlePrefix', locale) }}
              {{ tutorial.title[locale] }}
            </h3>
          </div>
        </li>
      </ul>
    </section>
  </template>

  <TutorialDetailDialog
    v-if="activeTutorial"
    :tutorial="activeTutorial"
    :locale="locale"
    @close="activeTutorial = null"
  />
</template>
