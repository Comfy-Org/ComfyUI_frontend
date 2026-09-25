<template>
  <Message
    :severity="statusSeverity"
    class="w-fit rounded-xl px-2 py-0.5 text-xs wrap-break-word"
  >
    <i
      class="pi pi-circle-fill mr-1.5 p-0 text-[0.6rem]"
      :style="{ opacity: 0.8 }"
    />
    {{ $t(`manager.status.${statusLabel}`) }}
  </Message>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Message from '@/components/ui/message/Message.vue'
import type { PackStatusType } from '@/workbench/extensions/manager/utils/packStatusPresentation'
import { resolvePackStatusPresentation } from '@/workbench/extensions/manager/utils/packStatusPresentation'

const { statusType, hasCompatibilityIssues, hasImportFailed } = defineProps<{
  statusType: PackStatusType
  hasCompatibilityIssues?: boolean
  hasImportFailed?: boolean
}>()

const presentation = computed(() =>
  resolvePackStatusPresentation({
    statusType,
    hasCompatibilityIssues,
    importFailed: hasImportFailed
  })
)

const statusLabel = computed(() => presentation.value.label)
const statusSeverity = computed(() => presentation.value.severity)
</script>
