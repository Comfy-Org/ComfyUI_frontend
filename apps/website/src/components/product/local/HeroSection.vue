<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'
import ProductHeroBadge from '../../common/ProductHeroBadge.vue'
import DownloadLocalButton from './DownloadLocalButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="overflow-hidden px-4 pt-20 pb-16 lg:px-20 lg:py-24">
    <div class="mx-auto flex max-w-5xl flex-col items-center">
      <div class="flex w-full max-w-2xl flex-col items-center text-center">
        <ProductHeroBadge />

        <h1
          class="text-primary-comfy-canvas mt-8 max-w-[10ch] text-5xl/tight font-light whitespace-pre-line lg:max-w-none lg:text-5xl"
        >
          {{ t('download.hero.heading', locale) }}
        </h1>

        <p
          class="text-primary-comfy-canvas mt-8 max-w-xs text-sm lg:mt-20 lg:max-w-xl lg:text-base"
        >
          {{ t('download.hero.subtitle', locale) }}
        </p>

        <div
          class="mt-10 flex w-full max-w-md flex-col gap-4 lg:w-auto lg:max-w-none lg:flex-row"
        >
          <DownloadLocalButton :locale class-name="lg:min-w-60" />
          <BrandButton
            :href="externalLinks.github"
            variant="outline"
            size="lg"
            class-name="flex items-center justify-center gap-2 lg:min-w-60"
          >
            <span
              class="icon-mask size-5 mask-[url('/icons/social/github.svg')]"
              aria-hidden="true"
            />
            {{ t('download.hero.installGithub', locale) }}
          </BrandButton>
        </div>
      </div>
    </div>
  </section>
</template>
