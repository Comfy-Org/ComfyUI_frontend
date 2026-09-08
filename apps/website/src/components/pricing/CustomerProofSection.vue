<script setup lang="ts">
import { customerVideoStories } from '../../data/customerVideos'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-12 lg:px-20">
    <h2
      class="text-center text-sm font-extrabold tracking-wider text-primary-warm-gray uppercase"
    >
      {{ t('pricing.customerProof.heading', locale) }}
    </h2>
    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <a
        v-for="story in customerVideoStories"
        :key="story.slug"
        :href="`/customers/videos/${story.slug}`"
        class="bg-transparency-white-t4 flex items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-white/8"
      >
        <img
          :src="story.poster"
          :width="story.posterWidth"
          :height="story.posterHeight"
          :alt="`${story.company}: ${story.title}`"
          loading="lazy"
          decoding="async"
          class="aspect-video w-28 shrink-0 rounded-xl object-cover"
        />
        <div>
          <p
            class="text-primary-comfy-yellow text-[10px] font-semibold tracking-widest uppercase"
          >
            {{ story.company }}
          </p>
          <p class="mt-1 text-sm font-light text-primary-comfy-canvas">
            {{ story.title }}
          </p>
        </div>
      </a>
    </div>
  </section>
</template>
