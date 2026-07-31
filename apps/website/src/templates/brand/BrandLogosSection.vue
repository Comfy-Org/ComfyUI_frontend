<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'

import SectionHeader from '../../components/common/SectionHeader.vue'
import { affiliateBrandAssets } from '../../data/affiliateBrandAssets'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const assets = affiliateBrandAssets.map((asset) =>
  asset.id === 'icon' ? { ...asset, preview: '/icons/comfyicon.svg' } : asset
)
</script>

<template>
  <section id="logos" class="max-w-9xl mx-auto px-6 py-10 lg:px-20 lg:py-12">
    <SectionHeader align="start" max-width="xl">
      {{ t('brand.logos.heading', locale) }}
      <template #subtitle>
        <p class="text-primary-warm-gray mt-4 max-w-2xl text-sm leading-[1.45]">
          {{ t('brand.logos.subheading', locale) }}
        </p>
      </template>
    </SectionHeader>

    <ul class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <li
        v-for="asset in assets"
        :key="asset.id"
        class="flex min-h-60 flex-col rounded-[30px] border-[1.5px] border-white/8 lg:min-h-[285px]"
      >
        <div class="flex flex-1 items-center justify-center p-8">
          <img
            :src="asset.preview"
            :alt="asset.title[locale]"
            :class="
              cn(
                'object-contain',
                asset.id === 'icon'
                  ? 'size-24 rounded-[23%] border border-white/10'
                  : 'max-h-24 max-w-[75%]'
              )
            "
            loading="lazy"
            decoding="async"
          />
        </div>
        <p
          class="pb-8 text-center text-[21px] font-medium tracking-[1.05px] text-primary-comfy-canvas"
        >
          {{ asset.title[locale] }}
        </p>
      </li>
    </ul>
  </section>
</template>
