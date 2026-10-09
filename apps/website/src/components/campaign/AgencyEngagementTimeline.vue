<script setup lang="ts">
import { computed } from 'vue'

import GlassCard from '@/components/common/GlassCard.vue'
import SectionHeader from '@/components/common/SectionHeader.vue'
import type { Locale } from '@/config/locales'
import { translationsFor } from '@/i18n/translations'

const { locale } = defineProps<{ locale: Locale }>()
const translations = computed(() => translationsFor(locale))
const steps = computed(() =>
  ([1, 2, 3, 4] as const).map((id) => ({
    id,
    title: translations.value.t(`vfxV2.agency.steps.${id}.title`),
    description: translations.value.t(`vfxV2.agency.steps.${id}.description`)
  }))
)
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-16 lg:px-12 lg:py-24">
    <SectionHeader align="start" max-width="xl">
      {{ translations.t('vfxV2.agency.processHeading') }}
    </SectionHeader>

    <ol class="mt-10 grid grid-cols-1 gap-6 lg:mt-14 lg:grid-cols-4">
      <li v-for="(step, index) in steps" :key="step.id" class="relative">
        <template v-if="index < steps.length - 1">
          <span
            aria-hidden="true"
            class="absolute top-10 -bottom-6 left-5 w-px bg-primary-comfy-yellow/30 lg:hidden"
          />
          <span
            aria-hidden="true"
            class="absolute top-5 -right-6 left-10 hidden h-px bg-primary-comfy-yellow/30 lg:block"
          />
        </template>

        <div class="flex items-start gap-5 lg:block">
          <span
            aria-hidden="true"
            class="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-primary-comfy-yellow/40 bg-primary-comfy-ink font-mono text-sm text-primary-comfy-yellow"
          >
            {{ step.id }}
          </span>
          <GlassCard class="min-w-0 flex-1 rounded-3xl p-6 lg:mt-5 lg:min-h-52">
            <h3 class="text-xl font-medium text-primary-comfy-canvas">
              {{ step.title }}
            </h3>
            <p class="mt-4 text-sm/relaxed text-primary-comfy-canvas/70">
              {{ step.description }}
            </p>
          </GlassCard>
        </div>
      </li>
    </ol>
  </section>
</template>
