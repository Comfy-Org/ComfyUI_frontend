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
      class="bg-transparency-white-t4 rounded-5xl flex flex-col-reverse items-stretch gap-10 p-2 lg:flex-row lg:gap-8"
    >
      <!-- Text content -->
      <div class="flex flex-1 flex-col justify-between p-6">
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
            :href="externalLinks.githubInstall"
            variant="outline"
            size="lg"
          >
            <span class="inline-flex items-center gap-2">
              <i
                class="icon-mask size-5 -translate-y-px mask-[url('/icons/social/github.svg')]"
                aria-hidden="true"
              />
              {{ t('download.hero.installGithub', locale) }}
            </span>
          </BrandButton>
        </div>
      </div>

      <div class="rounded-4.5xl w-full flex-1 overflow-hidden">
        <video
          src="https://media.comfy.org/website/local/racer.webm"
          autoplay
          loop
          muted
          playsinline
          aria-hidden="true"
          class="size-full object-cover"
        />
      </div>
    </div>
  </section>
</template>
