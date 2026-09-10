<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import SectionLabel from '../../components/common/SectionLabel.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <!--
    Source doc marks this quote and attribution as pending customer
    confirmation — do not merge to production before Silverside signs off.
  -->
  <section class="mx-auto max-w-3xl px-6 py-10 text-center lg:py-14">
    <SectionLabel>{{
      t('platform.router.testimonial.eyebrow', locale)
    }}</SectionLabel>
    <h2 class="mt-4 text-2xl font-light text-primary-comfy-canvas lg:text-3xl">
      {{ t('platform.router.testimonial.header', locale) }}
    </h2>
    <blockquote
      :class="
        cn(
          'border-primary-comfy-yellow mx-auto mt-8 max-w-2xl rounded-2xl border-l-4 p-8 text-left',
          'bg-(--site-bg-soft)'
        )
      "
    >
      <p class="text-lg/relaxed font-light text-primary-comfy-canvas italic">
        "{{ t('platform.router.testimonial.quote', locale) }}"
      </p>
      <p class="text-primary-comfy-yellow mt-4 text-sm font-semibold">
        {{ t('platform.router.testimonial.attribution', locale) }}
      </p>
    </blockquote>
  </section>
</template>
