<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { SHELF_CARD } from '@/lib/workshop/card-layout'
import { nameWithoutTask, taskLabelFor } from '@/lib/workshop/task-label'
import { useWorkshopWorkflowsEnabled } from '@/scripts/posthog'
import { isWorkshopModelShown } from '@/scripts/workshop-model-flags'
import CardRow from './CardRow.vue'
import ExploreKindTag from './ExploreKindTag.vue'
import ExploreResultCard from './ExploreResultCard.vue'

const { parts, locale = 'en' } = defineProps<{
  parts: readonly WorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const workflowsEnabled = useWorkshopWorkflowsEnabled()
const shown = computed(() =>
  parts.filter(
    (part) =>
      isWorkshopModelShown(part) &&
      (part.workflowId === undefined || workflowsEnabled.value)
  )
)
</script>

<template>
  <section
    v-if="shown.length"
    aria-labelledby="app-built-with"
    data-testid="app-built-with"
  >
    <CardRow :locale>
      <template #heading>
        <h2
          id="app-built-with"
          class="text-xl font-medium text-primary-warm-white"
        >
          {{ t('workshop.app.builtWith') }}
        </h2>
      </template>
      <li
        v-for="part in shown"
        :key="part.slug"
        :class="cn(SHELF_CARD, 'relative')"
      >
        <ExploreResultCard
          :href="part.href"
          :name="nameWithoutTask(part.name, taskLabelFor(part, locale))"
          :detail="taskLabelFor(part, locale)"
          :model="part"
        />
        <ExploreKindTag
          :kind="part.workflowId ? 'workflow' : 'model'"
          :locale
        />
      </li>
    </CardRow>
  </section>
</template>
