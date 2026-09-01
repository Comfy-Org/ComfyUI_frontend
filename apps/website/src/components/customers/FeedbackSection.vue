<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ScrollCarousel from '../ui/scroll-carousel/ScrollCarousel.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const feedbacks = [
  {
    quote: 'customers.feedback.quote1' as const,
    name: 'customers.feedback.name1' as const,
    role: 'customers.feedback.role1' as const
  },
  {
    quote: 'customers.feedback.quote2' as const,
    name: 'customers.feedback.name2' as const,
    role: 'customers.feedback.role2' as const
  },
  {
    quote: 'customers.feedback.quote3' as const,
    name: 'customers.feedback.name3' as const,
    role: 'customers.feedback.role3' as const
  }
]
</script>

<template>
  <ScrollCarousel :locale="locale">
    <div
      v-for="(fb, i) in feedbacks"
      :key="i"
      class="bg-transparency-white-t4 flex w-full shrink-0 snap-start flex-col justify-between rounded-3xl p-8 lg:w-3/4 lg:p-12"
    >
      <p class="text-2xl/relaxed font-light text-primary-comfy-canvas">
        "{{ t(fb.quote, locale) }}"
      </p>
      <div class="mt-12">
        <p class="text-primary-comfy-yellow text-base font-medium">
          {{ t(fb.name, locale) }},
        </p>
        <p class="text-primary-comfy-yellow text-base font-medium">
          {{ t(fb.role, locale) }}
        </p>
      </div>
    </div>
  </ScrollCarousel>
</template>
