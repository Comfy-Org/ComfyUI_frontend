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

import type { components } from '@/types/comfyRegistryTypes'
import { ImportFailedKey } from '@/workbench/extensions/manager/types/importFailedTypes'

type PackVersionStatus = components['schemas']['NodeVersionStatus']
type PackStatus = components['schemas']['NodeStatus']
type Status = PackVersionStatus | PackStatus

type MessageProps = InstanceType<typeof Message>['$props']
type MessageSeverity = MessageProps['severity']
type StatusProps = {
  label: string
  severity: MessageSeverity
}

const { statusType, hasCompatibilityIssues } = defineProps<{
  statusType: Status
  hasCompatibilityIssues?: boolean
}>()

// Inject import failed context from parent
const importFailedContext = inject(ImportFailedKey)
const importFailed = importFailedContext?.importFailed

const statusPropsMap: Record<Status, StatusProps> = {
  NodeStatusActive: {
    label: 'active',
    severity: 'success'
  },
  NodeStatusDeleted: {
    label: 'deleted',
    severity: 'warn'
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
    severity: 'warn'
  },
  NodeVersionStatusDeleted: {
    label: 'deleted',
    severity: 'warn'
  },
  NodeVersionStatusFlagged: {
    label: 'flagged',
    severity: 'warn'
  },
  NodeVersionStatusBanned: {
    label: 'banned',
    severity: 'error'
  }
}

// A security status is why the pack is conflicting, so it outranks the generic
// 'conflicting' label. Without this, banned and flagged both render as
// "Conflicting" and the user cannot tell a rejected version from an unreviewed
// one.
const SECURITY_STATUSES = new Set<Status>([
  'NodeStatusBanned',
  'NodeVersionStatusBanned',
  'NodeVersionStatusFlagged'
])

const isSecurityStatus = computed(() => SECURITY_STATUSES.has(statusType))

const statusLabel = computed(() => {
  if (importFailed?.value) return 'importFailed'
  if (hasCompatibilityIssues && !isSecurityStatus.value) return 'conflicting'
  return statusPropsMap[statusType]?.label || 'unknown'
})
const statusSeverity = computed(() => {
  if (importFailed?.value) return 'error'
  if (isSecurityStatus.value) return statusPropsMap[statusType]?.severity
  if (hasCompatibilityIssues) return 'error'
  return statusPropsMap[statusType]?.severity || 'secondary'
})
</script>
