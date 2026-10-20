<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { hubWorkflowUrl } from '@/lib/hub/routes'
import type { HubTemplate } from '@/lib/hub/types'
import HubWorkflowCard from './HubWorkflowCard.vue'
import LoadMoreButton from './LoadMoreButton.vue'

const {
  templates,
  total,
  moreUrl,
  locale = 'en'
} = defineProps<{
  templates: readonly HubTemplate[]
  total: number
  moreUrl: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const rest = ref<readonly HubTemplate[]>([])
const displayCount = ref(templates.length)
const displayed = computed(() =>
  [...templates, ...rest.value].slice(0, displayCount.value)
)

async function fetchRest() {
  const response = await fetch(moreUrl)
  if (!response.ok) return false
  const { hubTemplatesSchema } = await import('@/lib/hub/types')
  rest.value = hubTemplatesSchema.parse(await response.json())
  return true
}

async function loadMore() {
  const needsRest = templates.length + rest.value.length < total
  if (needsRest && !(await fetchRest())) return
  displayCount.value += templates.length
}
</script>

<template>
  <div>
    <div
      class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="hub-grid"
    >
      <HubWorkflowCard
        v-for="template in displayed"
        :key="template.name"
        :template
        :href="hubWorkflowUrl(template.name)"
        :try-now-label="t('workshop.hub.tryNow')"
        :locale
        :show-author="false"
      />
    </div>
    <LoadMoreButton
      v-if="displayCount < total"
      :label="t('workshop.hub.loadMore')"
      @click="loadMore"
    />
  </div>
</template>
