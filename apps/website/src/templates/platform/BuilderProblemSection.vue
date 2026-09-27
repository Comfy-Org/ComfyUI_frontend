<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import CheckIcon from '../../components/icons/CheckIcon.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const painNumbers = [1, 2, 3, 4] as const

const pains = painNumbers.map((n) => t(`platform.builderProblem.${n}`, locale))
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.builderProblem.heading', locale) }}
    </SectionHeader>

    <ul class="mx-auto mt-8 max-w-2xl space-y-3">
      <li
        v-for="pain in pains"
        :key="pain"
        class="flex items-start gap-2.5 text-sm/relaxed font-light text-primary-comfy-canvas"
      >
        <CheckIcon
          class="text-primary-comfy-yellow mt-1 size-4 shrink-0"
          aria-hidden="true"
        />
        {{ pain }}
      </li>
    </ul>
  </section>
</template>
