<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { computed } from 'vue'
import { ArrowUpRight } from '@lucide/vue'
import Button from '@/components/ui/button/Button.vue'
import { translationsFor } from '@/i18n/translations'
const { downloadUrl, downloadName, cloudHref, documentationURL, locale } =
  defineProps<{
    downloadUrl?: string
    downloadName: string | boolean
    cloudHref?: string
    documentationURL?: string
    locale: Locale
  }>()
const emit = defineEmits<{ download: []; tryCloud: [] }>()
const t = computed(() => translationsFor(locale).t)
</script>
<template>
  <div
    v-if="downloadUrl || cloudHref || documentationURL"
    class="mt-6 flex flex-wrap items-center gap-2"
    data-testid="workflow-actions"
  >
    <Button
      v-if="downloadUrl"
      as="a"
      :href="downloadUrl"
      :download="downloadName"
      variant="outline"
      class="h-auto min-h-11 max-w-full whitespace-normal"
      :aria-label="t('workshop.workflow.download')"
      @click="emit('download')"
      >{{ t('workshop.workflow.downloadShort') }}</Button
    >
    <Button
      v-if="cloudHref"
      as="a"
      :href="cloudHref"
      target="_blank"
      rel="noopener"
      variant="ghost"
      class="h-auto min-h-11 max-w-full font-bold tracking-wider whitespace-normal uppercase"
      @click="emit('tryCloud')"
      >{{ t('workshop.workflow.tryCloud') }}
      <template #append>
        <ArrowUpRight aria-hidden="true" />
      </template>
    </Button>
    <Button
      v-if="documentationURL"
      as="a"
      :href="documentationURL"
      target="_blank"
      rel="noopener noreferrer"
      variant="outline"
      class="h-auto min-h-11 max-w-full whitespace-normal"
      >{{ t('workshop.workflow.apiDocs') }}</Button
    >
  </div>
</template>
