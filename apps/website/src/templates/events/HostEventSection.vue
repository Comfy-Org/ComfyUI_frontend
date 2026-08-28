<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import Button from '../../components/ui/button/Button.vue'
import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<!-- The right column is a placeholder for the numbered five-step
StepsAccordion01 block. See .scratch/events-page-refactor/blueprint.md — the
block is not built yet. -->
<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <div class="flex flex-col gap-12 lg:flex-row lg:gap-24">
      <div class="max-w-sm shrink-0 lg:w-80">
        <h2
          class="text-3xl font-light tracking-tight text-primary-warm-white lg:text-5xl"
        >
          {{ t('events.host.title', locale) }}
        </h2>
        <p class="mt-6 text-base font-light text-primary-comfy-canvas">
          {{ t('events.host.lead', locale) }}
        </p>
        <Button
          as="a"
          :href="externalLinks.eventHostApplicationForm"
          class="mt-8"
        >
          {{ t('events.host.applyToHost', locale) }}
        </Button>
      </div>

      <div
        class="rounded-5xl flex min-h-96 grow items-center justify-center border-2 border-dashed border-primary-comfy-canvas/20"
      >
        <code class="text-sm text-primary-comfy-canvas/40">
          StepsAccordion01
        </code>
      </div>
    </div>
  </section>
</template>
