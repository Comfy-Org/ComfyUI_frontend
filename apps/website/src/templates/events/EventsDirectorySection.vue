<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<!-- Placeholder shell for the events directory (search, type/program filters,
Map | Cards | Calendar views, Leaflet world map, all-events list). See
.scratch/events-page-refactor/blueprint.md — the interactive children are not
built yet. -->
<template>
  <section
    id="events-directory"
    class="max-w-9xl mx-auto scroll-mt-24 px-6 py-16 lg:py-24"
  >
    <div class="mx-auto max-w-3xl text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-warm-white lg:text-5xl"
      >
        {{ t('events.directory.title', locale) }}
      </h2>
      <p
        class="mt-6 text-base font-light text-balance text-primary-comfy-canvas lg:text-lg"
      >
        {{ t('events.directory.lead', locale) }}
      </p>
    </div>

    <div
      class="rounded-5xl mt-10 flex h-96 items-center justify-center border-2 border-dashed border-primary-comfy-canvas/20 lg:mt-12"
    >
      <code class="text-sm text-primary-comfy-canvas/40">
        EventsDirectorySection
      </code>
    </div>
  </section>
</template>
