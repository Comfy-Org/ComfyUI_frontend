<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { computed } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import ApiFacts from './ApiFacts.vue'
import { translationsFor } from '@/i18n/translations'
const { keyHref, showDownload, facts, locale } = defineProps<{
  keyHref: string
  showDownload: boolean
  facts: readonly {
    label: string
    value: string
    mono?: boolean
    copyLabel?: string
  }[]
  locale: Locale
}>()
const emit = defineEmits<{ getKey: []; download: [] }>()
const t = computed(() => translationsFor(locale).t)
</script>
<template>
  <div
    class="flex w-full flex-col gap-3 lg:sticky lg:top-24 lg:w-95 lg:shrink-0"
  >
    <Button
      as="a"
      :href="keyHref"
      target="_blank"
      rel="noopener"
      variant="outline"
      class="w-full justify-between"
      data-testid="api-get-key"
      @click="emit('getKey')"
    >
      <template #prepend>
        <span
          class="inline-flex size-6 items-center justify-center rounded-full bg-primary-comfy-yellow/15 text-xs font-bold"
          aria-hidden="true"
          >1</span
        >
      </template>
      {{ t('workshop.api.getKey') }}
      <template #append><span aria-hidden="true">↗</span></template>
    </Button>
    <Button
      v-if="showDownload"
      variant="outline"
      class="w-full justify-between"
      @click="emit('download')"
    >
      <template #prepend>
        <span
          class="inline-flex size-6 items-center justify-center rounded-full bg-primary-comfy-yellow/15 text-xs font-bold"
          aria-hidden="true"
          >2</span
        >
      </template>
      {{ t('workshop.api.downloadGraph') }}
      <template #append><span aria-hidden="true">↓</span></template>
    </Button>
    <div data-testid="workflow-api-endpoint">
      <ApiFacts
        :where="t('workshop.api.runsOnCloud')"
        :rows="facts"
        :note="t('workshop.workflow.apiNote')"
      />
    </div>
  </div>
</template>
