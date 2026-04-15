<script setup lang="ts">
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import NodeBadge from '../common/NodeBadge.vue'
import BorderedPlaceholder from './BorderedPlaceholder.vue'

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

      <!-- Feature accordion -->
      <div class="flex w-full flex-col lg:w-85 lg:gap-4">
        <template v-for="(feature, i) in features" :key="feature.title">
          <!-- Image area (mobile, rendered before active item) -->
          <BorderedPlaceholder
            v-if="activeIndex === i"
            class="lg:hidden"
            :class="i !== 0 ? 'mt-4' : ''"
          />

          <!-- Connector (mobile) -->
          <div
            v-if="activeIndex === i"
            class="flex h-5 items-center overflow-visible lg:hidden"
          >
            <img
              src="/icons/node-link.svg"
              alt=""
              class="ml-20 h-8 w-5 rotate-90"
              aria-hidden="true"
            />
          </div>

          <!-- Accordion item with connector -->
          <div
            class="flex items-stretch"
            :class="activeIndex !== i ? 'mt-4 lg:mt-0' : ''"
          >
            <img
              v-if="activeIndex === i"
              src="/icons/node-link.svg"
              alt=""
              class="hidden self-center lg:block"
              aria-hidden="true"
            />
            <button
              type="button"
              class="rounded-5xl w-full cursor-pointer p-8 text-left transition-colors duration-300"
              :class="
                activeIndex === i
                  ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                  : 'bg-transparency-white-t4 text-primary-comfy-canvas lg:ml-5'
              "
              @click="activeIndex = i"
            >
              <div class="flex items-start justify-between gap-3">
                <h3 class="text-2xl/tight font-medium">
                  {{ feature.title }}
                </h3>
                <img
                  src="/icons/plus.svg"
                  alt=""
                  class="size-5 shrink-0 transition-opacity duration-300"
                  :class="activeIndex === i ? 'opacity-0' : 'opacity-100'"
                  aria-hidden="true"
                />
              </div>

              <!-- Animated description (stacked for constant height) -->
              <div
                class="grid transition-[grid-template-rows] duration-300"
                :class="
                  activeIndex === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                "
              >
                <div class="grid overflow-hidden">
                  <p
                    v-for="(f, j) in features"
                    :key="f.title"
                    class="col-start-1 row-start-1 mt-4 text-sm/relaxed font-normal opacity-80"
                    :class="j === i ? 'visible' : 'invisible'"
                  >
                    {{ f.description }}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
