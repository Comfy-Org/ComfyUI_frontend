<script setup lang="ts">
import type { TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { t } = translationsFor('en')

defineProps<{
  runsOnCloud: boolean
  facts: readonly { label: TranslationKey; value: string }[]
}>()
</script>

<template>
  <p class="text-sm text-primary-warm-white">
    {{
      t(
        runsOnCloud
          ? 'workshop.workflow.cloudReady'
          : 'workshop.workflow.runsOwn'
      )
    }}
  </p>
  <dl class="flex flex-col gap-1 text-sm" data-testid="workflow-details">
    <div
      v-for="fact in facts"
      :key="fact.label"
      class="grid grid-cols-[6rem_1fr] gap-4"
    >
      <dt class="text-primary-warm-gray">{{ t(fact.label) }}</dt>
      <dd class="min-w-0 truncate text-primary-comfy-canvas tabular-nums">
        {{ fact.value }}
      </dd>
    </div>
  </dl>
</template>
