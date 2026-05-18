<script setup lang="ts">
import { customerStories } from '../../config/customerStories'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
</script>

<template>
  <section
    class="grid grid-cols-1 gap-6 px-6 py-16 lg:grid-cols-2 lg:px-16 lg:py-24"
  >
    <a
      v-for="story in customerStories"
      :key="story.slug"
      :href="`${prefix}/customers/${story.slug}`"
      class="bg-transparency-white-t4 group flex flex-col overflow-hidden rounded-3xl transition-colors hover:bg-white/8"
    >
      <!-- Image -->
      <div class="m-2 aspect-video overflow-hidden rounded-2xl">
        <div
          class="size-full rounded-2xl bg-white/5 bg-cover bg-center"
          :style="{ backgroundImage: `url(${story.image})` }"
        />
      </div>

      <!-- Content -->
      <div class="flex flex-1 flex-col justify-between px-6 pt-4 pb-6">
        <div>
          <span
            class="text-primary-comfy-yellow text-[10px] font-semibold tracking-widest uppercase"
          >
            {{ t(story.category, locale) }}
          </span>
          <h3
            class="text-primary-comfy-canvas mt-2 text-lg/snug font-light lg:text-xl/snug"
          >
            {{ t(story.title, locale) }}
          </h3>
        </div>

        <div
          class="mt-8 flex items-center gap-3 text-xs font-semibold tracking-widest uppercase"
        >
          <span
            class="bg-primary-comfy-yellow flex size-8 items-center justify-center rounded-full"
          >
            <img src="/icons/arrow-right.svg" alt="" class="ml-0.5 size-3" />
          </span>
          <span class="text-primary-comfy-canvas">
            {{ t('customers.story.viewArticle', locale) }}
          </span>
        </div>
      </div>
    </a>
  </section>
</template>
