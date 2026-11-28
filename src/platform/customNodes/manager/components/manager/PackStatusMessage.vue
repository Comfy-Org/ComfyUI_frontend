<template>
  <Message
    :severity="status.severity"
    class="w-fit rounded-xl px-2 py-0.5 text-xs wrap-break-word"
  >
    <i
      class="pi pi-circle-fill mr-1.5 text-[0.6rem]"
      :style="{ opacity: 0.8 }"
    />
    {{ $t(`manager.status.${status.label}`) }}
  </Message>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { MessageVariants } from '@comfyorg/design-system/lib/message/message.variants'
import Message from '@comfyorg/design-system/message/Message'
import type { components } from '@/types/comfyRegistryTypes'

type PackVersionStatus = components['schemas']['NodeVersionStatus']
type PackStatus = components['schemas']['NodeStatus']
type Status = PackVersionStatus | PackStatus

type StatusProps = {
  label: string
  severity: MessageVariants['severity']
}

const {
  statusType,
  hasCompatibilityIssues,
  hasImportFailed,
  isInvalidInstallation
} = defineProps<{
  statusType?: Status
  hasCompatibilityIssues?: boolean
  hasImportFailed?: boolean
  isInvalidInstallation?: boolean
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

const status = computed<StatusProps>(() => {
  if (hasImportFailed) return { label: 'importFailed', severity: 'error' }
  if (isInvalidInstallation)
    return { label: 'invalidInstallation', severity: 'warning' }
  if (hasCompatibilityIssues) return { label: 'conflicting', severity: 'error' }
  return (
    (statusType && statusPropsMap[statusType]) ?? {
      label: 'unknown',
      severity: 'secondary'
    }
  )
})
</script>
