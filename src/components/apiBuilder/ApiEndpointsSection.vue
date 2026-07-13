<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import type { ApiSpec } from './apiSpec'
import ApiDocsSection from './ApiDocsSection.vue'

const { spec } = defineProps<{ spec: ApiSpec }>()

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()

const endpoints = computed(() => [
  {
    method: 'POST',
    url: spec.submitUrl,
    label: t('apiBuilder.submitEndpoint')
  },
  {
    method: 'GET',
    url: spec.jobUrl,
    label: t('apiBuilder.pollEndpoint')
  }
])
</script>

<template>
  <ApiDocsSection
    :title="t('apiBuilder.endpointsTitle')"
    :description="t('apiBuilder.endpointsDescription')"
  >
    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      <li
        v-for="endpoint in endpoints"
        :key="endpoint.url"
        class="flex items-center gap-3 rounded-lg bg-secondary-background px-3 py-2"
      >
        <span
          class="rounded-md bg-primary-background/20 px-2 py-0.5 font-mono text-xs font-bold text-primary-background"
        >
          {{ endpoint.method }}
        </span>
        <code class="min-w-0 flex-1 truncate font-mono text-sm">
          {{ endpoint.url }}
        </code>
        <span class="text-xs whitespace-nowrap text-muted-foreground">
          {{ endpoint.label }}
        </span>
        <Button
          variant="textonly"
          size="icon"
          :aria-label="t('g.copy')"
          @click="copyToClipboard(endpoint.url)"
        >
          <i class="icon-[lucide--copy]" />
        </Button>
      </li>
    </ul>
  </ApiDocsSection>
</template>
