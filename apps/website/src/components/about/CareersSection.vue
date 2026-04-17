<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="px-6 py-24 lg:px-20 lg:py-32">
    <div
      class="bg-transparency-white-t4 rounded-5xl mx-auto mt-20 flex flex-col gap-12 p-2 lg:flex-row lg:items-stretch lg:gap-8"
    >
      <!-- Team photo -->
      <div class="aspect-video w-full overflow-hidden rounded-4xl lg:w-1/2">
        <img
          src="/images/about/team.webp"
          alt="Comfy team"
          class="size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>

      <!-- Join text -->
      <div class="flex flex-col justify-between p-6 lg:w-1/2">
        <div>
          <span
            class="text-primary-comfy-yellow text-xs font-semibold tracking-widest uppercase"
          >
            {{ t('about.careers.label', locale) }}
          </span>
          <h2
            class="text-primary-comfy-canvas mt-4 text-3xl font-light lg:text-5xl"
          >
            {{ t('about.careers.heading', locale) }}
          </h2>
        </div>
        <div>
          <BrandButton
            :href="locale === 'zh-CN' ? '/zh-CN/careers' : '/careers'"
            :label="t('about.careers.cta', locale)"
            variant="solid"
            class-name="mt-8 self-start rounded-2xl"
          />
          <p class="text-primary-warm-gray mt-6 text-sm">
            {{ t('about.careers.noRole', locale) }}
            <a
              href="mailto:hiring@comfy.org"
              class="text-primary-comfy-yellow hover:underline"
            >
              hiring@comfy.org
            </a>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
