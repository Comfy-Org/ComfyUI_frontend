<script setup lang="ts">
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import NodeBadge from '../common/NodeBadge.vue'
import BorderedPlaceholder from './BorderedPlaceholder.vue'
import FeatureCard from './FeatureCard.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const features = [
  {
    title: t('showcase.feature1.title', locale),
    description: t('showcase.feature1.description', locale),
    image: ''
  },
  {
    title: t('showcase.feature2.title', locale),
    description: t('showcase.feature2.description', locale),
    image: ''
  },
  {
    title: t('showcase.feature3.title', locale),
    description: t('showcase.feature3.description', locale),
    image: ''
  }
]

const badgeSegments = [
  { text: t('showcase.badgeHow', locale) },
  { logoSrc: '/icons/logo.svg', logoAlt: 'Comfy' },
  { text: t('showcase.badgeWorks', locale) }
]

const activeIndex = ref(0)
</script>

<template>
  <section class="px-4 py-20 lg:px-20 lg:py-24">
    <!-- Section header -->
    <div class="flex flex-col items-center text-center">
      <NodeBadge :segments="badgeSegments" segment-class="" />
      <p class="text-primary-comfy-canvas mt-12 max-w-xl text-sm/relaxed">
        {{ t('showcase.subtitle1', locale) }}
      </p>
      <p class="text-primary-comfy-canvas mt-4 max-w-xl text-sm/relaxed">
        {{ t('showcase.subtitle2', locale) }}
      </p>
    </div>

    <!-- Content area -->
    <div class="mt-12 flex flex-col lg:mt-24 lg:flex-row lg:items-stretch">
      <!-- Image area (desktop only) -->
      <BorderedPlaceholder class="hidden flex-1 lg:flex" />

      <!-- Feature accordion (desktop) -->
      <div class="hidden w-full lg:flex lg:w-80 lg:flex-col lg:gap-4 lg:pl-5">
        <template v-for="(feature, i) in features" :key="feature.title">
          <!-- Active: connector + stacked cards (constant height) -->
          <div v-if="activeIndex === i" class="flex items-stretch lg:-ml-5">
            <img
              src="/icons/node-link.svg"
              alt=""
              class="-mx-px self-center"
              aria-hidden="true"
            />
            <div class="grid w-full">
              <FeatureCard
                v-for="(f, j) in features"
                :key="f.title"
                :title="f.title"
                :description="f.description"
                :class="activeIndex === j ? 'visible' : 'invisible'"
                class="col-start-1 row-start-1"
                @click="activeIndex = j"
              />
            </div>
          </div>

          <!-- Inactive: stacked buttons (constant height) -->
          <div v-else class="grid">
            <button
              v-for="(f, j) in features"
              :key="f.title"
              class="rounded-5xl col-start-1 row-start-1 w-full cursor-pointer p-8 text-left transition-all"
              :class="
                j === i
                  ? 'bg-transparency-white-t4 text-primary-comfy-canvas visible'
                  : 'invisible'
              "
              :tabindex="j === i ? 0 : -1"
              @click="activeIndex = j"
            >
              <div class="flex items-start justify-between gap-3">
                <h3 class="text-2xl/tight font-medium">
                  {{ f.title }}
                </h3>
                <img
                  src="/icons/plus.svg"
                  alt=""
                  class="size-5 shrink-0"
                  aria-hidden="true"
                />
              </div>
            </button>
          </div>
        </template>
      </div>

      <!-- Feature accordion (mobile) -->
      <div class="flex w-full flex-col lg:hidden">
        <template v-for="(feature, i) in features" :key="feature.title">
          <!-- Image area (mobile, rendered before active item) -->
          <BorderedPlaceholder
            v-if="activeIndex === i"
            :class="activeIndex !== 0 ? 'mt-4' : 'mt-0'"
          />

          <!-- Active: connector (mobile only) -->
          <div v-if="activeIndex === i" class="flex items-stretch">
            <img
              src="/icons/node-link.svg"
              alt=""
              class="-my-2.25 ml-20 block scale-x-75 scale-y-50 rotate-90"
              aria-hidden="true"
            />
          </div>

          <!-- Active card (mobile only) -->
          <FeatureCard
            v-if="activeIndex === i"
            :title="feature.title"
            :description="feature.description"
            @click="activeIndex = i"
          />

          <!-- Inactive card (mobile) -->
          <button
            v-else
            class="rounded-5xl bg-transparency-white-t4 text-primary-comfy-canvas mt-4 w-full cursor-pointer p-8 text-left transition-all"
            @click="activeIndex = i"
          >
            <div class="flex items-start justify-between gap-3">
              <h3 class="text-2xl/tight font-medium">
                {{ feature.title }}
              </h3>
              <img
                src="/icons/plus.svg"
                alt=""
                class="size-5 shrink-0"
                aria-hidden="true"
              />
            </div>
          </button>
        </template>
      </div>
    </div>
  </section>
</template>
