<script setup lang="ts">
import { useScroll } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { Locale } from '../../i18n/translations'

import BrandButton from '../../components/common/BrandButton.vue'
import { getRoutes } from '../../config/routes'
import { seedanceReviews } from '../../data/seedance'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const reviews = seedanceReviews.map((review) => ({
  id: review.id,
  title: review.title?.[locale],
  body: review.body[locale],
  name: review.name,
  role: review.role?.[locale]
}))

const trackRef = ref<HTMLElement>()
const { x } = useScroll(trackRef)

const progress = computed(() => {
  const el = trackRef.value
  if (!el) return 0
  const max = el.scrollWidth - el.clientWidth
  return max > 0 ? x.value / max : 0
})

const progressPercent = computed(() => `${progress.value * 100}%`)

function scroll(direction: -1 | 1) {
  const el = trackRef.value
  if (!el) return
  el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' })
}
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:px-16 lg:py-24">
    <!-- Comfy MCP highlight card -->
    <div
      class="rounded-5xl bg-primary-comfy-yellow flex flex-col gap-6 p-8 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-8"
    >
      <div class="min-w-0 flex-1">
        <h3
          class="text-2xl font-medium text-primary-comfy-ink lg:text-3xl/tight"
        >
          {{ t('seedance.reviews.highlightTitle', locale) }}
        </h3>
        <p class="mt-4 text-base/relaxed font-light text-primary-comfy-ink">
          {{ t('seedance.reviews.highlightDescription', locale) }}
        </p>
      </div>

      <BrandButton
        :href="routes.mcp"
        variant="inverse"
        size="sm"
        class="h-12 shrink-0 px-5 uppercase"
      >
        {{ t('seedance.reviews.highlightCta', locale) }}
      </BrandButton>
    </div>

    <!-- Reviews heading -->
    <h2
      class="mt-20 text-center text-3xl font-light tracking-tight text-primary-comfy-canvas lg:mt-28 lg:text-5xl/tight"
    >
      {{ t('seedance.reviews.heading', locale) }}
    </h2>

    <!-- Scrollable track -->
    <div
      ref="trackRef"
      class="mt-12 flex snap-x snap-mandatory scrollbar-none gap-8 overflow-x-auto lg:mt-16"
    >
      <article
        v-for="review in reviews"
        :key="review.id"
        class="bg-transparency-white-t4 rounded-5xl flex w-full shrink-0 snap-start flex-col justify-between p-8 lg:w-2/3 lg:p-12"
      >
        <div>
          <template v-if="review.title">
            <p
              class="text-2xl font-medium text-primary-comfy-canvas lg:text-3xl/snug"
            >
              {{ review.title }}
            </p>
            <p
              class="mt-6 text-lg/relaxed font-light text-primary-comfy-canvas lg:text-xl/relaxed"
            >
              {{ review.body }}
            </p>
          </template>
          <p
            v-else
            class="text-xl/relaxed font-light text-primary-comfy-canvas lg:text-2xl/relaxed"
          >
            "{{ review.body }}"
          </p>
        </div>

        <p class="text-primary-comfy-yellow mt-10 text-base lg:mt-12">
          <span class="font-medium">{{ review.name }}</span
          ><template v-if="review.role">,<br />{{ review.role }}</template>
        </p>
      </article>
    </div>

    <!-- Controls -->
    <div class="mt-10 flex items-center gap-4">
      <div class="h-1 flex-1 rounded-full bg-white/20">
        <div
          class="bg-primary-comfy-yellow h-full rounded-full"
          :style="{ width: progressPercent }"
        />
      </div>

      <button
        class="flex size-10 items-center justify-center rounded-full border border-white/20 text-white/60 transition-colors hover:border-white/40"
        :aria-label="locale === 'zh-CN' ? '上一条' : 'Previous'"
        @click="scroll(-1)"
      >
        <img
          src="/icons/arrow-right.svg"
          alt=""
          class="size-3 rotate-180 opacity-60 invert"
        />
      </button>

      <button
        class="bg-primary-comfy-yellow flex size-10 items-center justify-center rounded-full transition-opacity hover:opacity-90"
        :aria-label="locale === 'zh-CN' ? '下一条' : 'Next'"
        @click="scroll(1)"
      >
        <img src="/icons/arrow-right.svg" alt="" class="size-3" />
      </button>
    </div>
  </section>
</template>
