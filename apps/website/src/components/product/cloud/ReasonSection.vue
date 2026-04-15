<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import type { Reason } from '../shared/ReasonSection.vue'

import ReasonSection from '../shared/ReasonSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

interface CloudReason extends Reason {
  badge?: boolean
}

const reasons: CloudReason[] = [
  {
    titleKey: 'cloud.reason.1.title',
    descriptionKey: 'cloud.reason.1.description'
  },
  {
    titleKey: 'cloud.reason.2.title',
    descriptionKey: 'cloud.reason.2.description',
    badge: true
  },
  {
    titleKey: 'cloud.reason.3.title',
    descriptionKey: 'cloud.reason.3.description'
  },
  {
    titleKey: 'cloud.reason.4.title',
    descriptionKey: 'cloud.reason.4.description'
  }
]
</script>

<template>
  <ReasonSection
    :locale="locale"
    heading-key="cloud.reason.heading"
    heading-highlight-key="cloud.reason.headingHighlight"
    :reasons="reasons"
  >
    <template #reason-extra="{ reason }">
      <div v-if="(reason as CloudReason).badge" class="mt-3">
        <span
          class="font-formula-condensed text-primary-comfy-yellow text-lg font-bold tracking-wide"
        >
          ONLY ON
          <img src="/icons/logo.svg" alt="Comfy" class="inline-block h-5" />
          CLOUD
        </span>
      </div>
    </template>
  </ReasonSection>
</template>
