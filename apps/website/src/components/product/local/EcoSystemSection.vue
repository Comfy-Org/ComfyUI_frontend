<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'
import DownloadLocalButton from './DownloadLocalButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="px-4 py-24 lg:px-20 lg:py-40">
    <div
      class="flex flex-col-reverse items-stretch gap-10 lg:flex-row lg:gap-16"
    >
      <!-- Text content -->
      <div class="flex flex-1 flex-col justify-between">
        <div>
          <h2 class="text-primary-comfy-canvas text-3xl font-light lg:text-4xl">
            {{ t('download.ecosystem.heading', locale) }}
          </h2>
          <p class="text-primary-comfy-canvas/70 mt-6 text-sm">
            {{ t('download.ecosystem.description', locale) }}
          </p>
        </div>

        <!-- CTA buttons -->
        <div class="mt-10 flex flex-col gap-4 lg:flex-row">
          <DownloadLocalButton :locale />
          <BrandButton
            :href="externalLinks.github"
            variant="outline"
            size="lg"
            class="flex items-center justify-center gap-2"
          >
            <span
              class="icon-mask size-5 mask-[url('/icons/social/github.svg')]"
              aria-hidden="true"
            />
            {{ t('download.hero.installGithub', locale) }}
          </BrandButton>
        </div>
      </div>

      <!-- TODO: Replace with final ecosystem illustration -->
      <div class="flex-1">
        <div
          class="aspect-4/3 w-full overflow-hidden rounded-3xl bg-linear-to-b from-emerald-300 to-amber-200"
        >
          <div class="flex h-full items-center justify-center">
            <span
              class="bg-primary-comfy-ink text-primary-comfy-yellow rounded-full px-4 py-2 text-sm font-bold"
            >
              4x
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
