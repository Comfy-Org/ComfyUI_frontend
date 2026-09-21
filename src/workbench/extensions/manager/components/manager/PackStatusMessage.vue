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

import type { MessageVariants } from '@/components/ui/message/message.variants'
import Message from '@/components/ui/message/Message.vue'
import type { components } from '@/types/comfyRegistryTypes'

type PackVersionStatus = components['schemas']['NodeVersionStatus']
type PackStatus = components['schemas']['NodeStatus']
type Status = PackVersionStatus | PackStatus

type StatusProps = {
  label: string
  severity: MessageVariants['severity']
}

const { statusType, hasCompatibilityIssues, hasImportFailed } = defineProps<{
  statusType: Status
  hasCompatibilityIssues?: boolean
  hasImportFailed?: boolean
}>()

const statusPropsMap: Record<Status, StatusProps> = {
  NodeStatusActive: {
    label: 'active',
    severity: 'success'
  },
  NodeStatusDeleted: {
    label: 'deleted',
    severity: 'warning'
  },
  NodeStatusBanned: {
    label: 'banned',
    severity: 'error'
  },
  NodeVersionStatusActive: {
    label: 'active',
    severity: 'success'
  },
  NodeVersionStatusPending: {
    label: 'pending',
    severity: 'warning'
  },
  NodeVersionStatusDeleted: {
    label: 'deleted',
    severity: 'warning'
  },
  NodeVersionStatusFlagged: {
    label: 'flagged',
    severity: 'error'
  },
  NodeVersionStatusBanned: {
    label: 'banned',
    severity: 'error'
  }
}

const statusLabel = computed(() => {
  if (hasImportFailed) return 'importFailed'
  if (hasCompatibilityIssues) return 'conflicting'
  return statusPropsMap[statusType]?.label || 'unknown'
})
const statusSeverity = computed(() => {
  if (hasCompatibilityIssues || hasImportFailed) return 'error'
  return statusPropsMap[statusType]?.severity || 'secondary'
})
</script>
