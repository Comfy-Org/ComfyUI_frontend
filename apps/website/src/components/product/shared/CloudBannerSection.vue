<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="bg-transparency-white-t4 p-4 text-center lg:px-20 lg:py-8">
    <p
      class="text-primary-comfy-canvas relative z-10 text-lg font-semibold lg:text-sm lg:font-normal"
    >
      {{ t('download.cloud.prefix', locale) }}
      <a
        :href="externalLinks.cloud"
        class="text-primary-comfy-yellow mx-1 font-bold tracking-widest uppercase hover:underline"
      >
        {{ t('download.cloud.cta', locale) }}
      </a>
      <span class="mt-1 block lg:mt-0 lg:inline">
        {{ t('download.cloud.suffix', locale) }}
      </span>
    </p>
  </section>
</template>
