<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { Box } from '@lucide/vue'
import { computed } from 'vue'
import { translationsFor } from '@/i18n/translations'
const { models, locale } = defineProps<{
  models: { uid: string; name: string; href?: string }[]
  locale: Locale
}>()
const t = computed(() => translationsFor(locale).t)
</script>
<template>
  <section
    v-if="models.length"
    class="px-5 py-4"
    data-testid="workflow-runs-on"
  >
    <h3
      class="text-2xs font-bold tracking-wider text-primary-warm-gray uppercase"
    >
      {{ t('workshop.workflow.runsOn') }}
    </h3>
    <ul class="mt-2 flex flex-col gap-1">
      <li
        v-for="item in models"
        :key="item.uid"
        class="flex items-center gap-2.5 py-1.5"
      >
        <Box
          class="size-4 shrink-0 text-primary-warm-gray"
          aria-hidden="true"
        />
        <a
          v-if="item.href"
          :href="item.href"
          class="min-w-0 flex-1 truncate text-base text-primary-comfy-canvas underline underline-offset-4 hover:text-primary-comfy-yellow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-comfy-yellow"
          >{{ item.name }}</a
        >
        <span
          v-else
          class="min-w-0 flex-1 truncate text-base text-primary-comfy-canvas"
          >{{ item.name }}</span
        >
      </li>
    </ul>
  </section>
</template>
