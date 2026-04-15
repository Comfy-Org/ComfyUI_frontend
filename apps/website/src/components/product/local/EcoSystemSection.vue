<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { useDownloadUrl } from '../../../composables/useDownloadUrl'
import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { downloadUrl } = useDownloadUrl()
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
          <a
            :href="downloadUrl"
            target="_blank"
            rel="noopener"
            class="bg-primary-comfy-yellow text-primary-comfy-ink rounded-full px-8 py-4 text-center text-sm font-bold tracking-wider transition-opacity hover:opacity-90"
          >
            {{ t('download.hero.downloadLocal', locale) }}
          </a>
          <a
            :href="externalLinks.github"
            target="_blank"
            rel="noopener"
            class="border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink flex items-center justify-center gap-2 rounded-full border px-8 py-4 text-sm font-bold tracking-wider transition-colors"
          >
            <span
              class="icon-mask size-5 mask-[url('/icons/social/github.svg')]"
              aria-hidden="true"
            />
            {{ t('download.hero.installGithub', locale) }}
          </a>
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
