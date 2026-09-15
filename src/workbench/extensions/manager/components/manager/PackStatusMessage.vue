<template>
  <Message
    :severity="statusSeverity"
    class="flex w-fit items-center rounded-xl p-0 wrap-break-word"
    :pt="{
      text: { class: 'text-xs' },
      content: { class: 'px-2 py-0.5' }
    }"
  >
    <i
      class="pi pi-circle-fill mr-1.5 p-0 text-[0.6rem]"
      :style="{ opacity: 0.8 }"
    />
    {{ $t(`manager.status.${statusLabel}`) }}
  </Message>
</template>

<script setup lang="ts">
import Message from 'primevue/message'
import { computed, inject } from 'vue'

import { ImportFailedKey } from '@/workbench/extensions/manager/types/importFailedTypes'
import type { PackStatusType } from '@/workbench/extensions/manager/utils/packStatusPresentation'
import { resolvePackStatusPresentation } from '@/workbench/extensions/manager/utils/packStatusPresentation'

const { statusType, hasCompatibilityIssues } = defineProps<{
  statusType: PackStatusType
  hasCompatibilityIssues?: boolean
}>()

// Inject import failed context from parent
const importFailedContext = inject(ImportFailedKey)
const importFailed = importFailedContext?.importFailed

const presentation = computed(() =>
  resolvePackStatusPresentation({
    statusType,
    hasCompatibilityIssues,
    importFailed: importFailed?.value
  })
)

const statusLabel = computed(() => presentation.value.label)
const statusSeverity = computed(() => presentation.value.severity)
</script>
