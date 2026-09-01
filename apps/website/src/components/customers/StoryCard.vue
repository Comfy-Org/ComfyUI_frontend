<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { StoryCard } from '../../utils/customers'

const { story, locale = 'en' } = defineProps<{
  story: StoryCard
  locale?: Locale
}>()

const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
</script>

<template>
  <a
    :href="`${prefix}/customers/${story.slug}`"
    class="bg-transparency-white-t4 group flex flex-col overflow-hidden rounded-3xl transition-colors hover:bg-white/8"
  >
    <div class="m-2 aspect-video overflow-hidden rounded-2xl">
      <div
        class="size-full rounded-2xl bg-white/5 bg-cover bg-center"
        :style="{ backgroundImage: `url(${story.cover})` }"
      />
    </div>

    <div class="flex flex-1 flex-col justify-between px-6 pt-4 pb-6">
      <div>
        <span
          class="text-primary-comfy-yellow text-[10px] font-semibold tracking-widest uppercase"
        >
          {{ story.category }}
        </span>
        <h3
          class="mt-2 text-lg/snug font-light text-primary-comfy-canvas lg:text-xl/snug"
        >
          {{ story.title }}
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
</template>
