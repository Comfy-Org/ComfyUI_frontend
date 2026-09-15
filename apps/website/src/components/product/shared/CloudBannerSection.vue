<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="relative z-20 bg-transparency-white-t4 p-4 text-center lg:px-20 lg:py-8"
  >
    <p
      class="relative z-10 text-sm font-semibold text-primary-comfy-canvas lg:text-sm lg:font-normal"
    >
      <span class="whitespace-nowrap">
        {{ t('download.cloud.prefix', locale) }}
      </span>
      <a
        :href="externalLinks.cloud"
        class="mx-1 font-bold tracking-widest whitespace-nowrap text-primary-comfy-yellow uppercase hover:underline"
      >
        {{ t('download.cloud.cta', locale) }}
      </a>
      <span class="mt-1 block lg:mt-0 lg:inline">
        {{ t('download.cloud.suffix', locale) }}
      </span>
    </p>
  </section>
</template>
