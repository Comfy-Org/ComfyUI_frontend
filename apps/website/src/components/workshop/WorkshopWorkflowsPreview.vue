<script setup lang="ts">
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { scope } = usePrototypeTweaks()
</script>

<template>
  <section
    v-if="scope === 'v2'"
    class="mt-16 rounded-2xl border border-dashed border-transparency-white-t8 px-6 py-12 text-center"
    data-testid="workshop-workflows-preview"
  >
    <p
      class="text-primary-comfy-yellow mb-2 text-sm font-medium tracking-widest uppercase"
    >
      {{ t('workshop.workflows.eyebrow', locale) }}
    </p>
    <h2 class="text-2xl font-bold text-primary-comfy-canvas lg:text-3xl">
      {{ t('workshop.workflows.heading', locale) }}
    </h2>
    <p class="mx-auto mt-4 max-w-2xl text-base text-primary-comfy-canvas/70">
      {{ t('workshop.workflows.body', locale) }}
    </p>
  </section>
</template>
