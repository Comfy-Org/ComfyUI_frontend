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
  <section class="px-4 py-40 lg:px-20">
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

      <!-- Feature accordion -->
      <div class="flex w-full flex-col lg:w-80 lg:gap-4 lg:pl-5">
        <template v-for="(feature, i) in features" :key="feature.title">
          <!-- Image area (mobile, rendered before active item) -->
          <BorderedPlaceholder
            v-if="activeIndex === i"
            class="lg:hidden"
            :class="activeIndex !== 0 ? 'mt-4 lg:mt-0' : 'mt-0'"
          />

          <!-- Active: connector + card -->
          <div v-if="activeIndex === i" class="flex items-stretch lg:-ml-5">
            <img
              src="/icons/node-link.svg"
              alt=""
              class="-mx-px hidden self-center lg:block"
              aria-hidden="true"
            />
            <img
              src="/icons/node-link.svg"
              alt=""
              class="-my-2.25 ml-20 block scale-x-75 scale-y-50 rotate-90 lg:hidden"
              aria-hidden="true"
            />
            <FeatureCard
              :title="feature.title"
              :description="feature.description"
              @click="activeIndex = i"
            />
          </div>

          <!-- Inactive card -->
          <button
            v-else
            class="rounded-5xl bg-transparency-white-t4 text-primary-comfy-canvas mt-4 w-full cursor-pointer p-8 text-left transition-all lg:mt-0"
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
