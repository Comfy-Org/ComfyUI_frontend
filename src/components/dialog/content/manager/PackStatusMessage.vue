<template>
  <Message
    :severity="statusSeverity"
    class="p-0 flex items-center rounded-xl break-words w-fit"
    :pt="{
      text: { class: 'text-xs' },
      content: { class: 'px-2 py-0.5' }
    }"
  >
    <i
      class="pi pi-circle-fill mr-1.5 text-[0.6rem] p-0"
      :style="{ opacity: 0.8 }"
    />
    {{ $t(`manager.status.${statusLabel}`) }}
  </Message>
</template>

<script setup lang="ts">
import Message from 'primevue/message'
import { computed } from 'vue'

import { components } from '@/types/comfyRegistryTypes'

type PackVersionStatus = components['schemas']['NodeVersionStatus']
type PackStatus = components['schemas']['NodeStatus']
type Status = PackVersionStatus | PackStatus

type MessageProps = InstanceType<typeof Message>['$props']
type MessageSeverity = MessageProps['severity']
type StatusProps = {
  label: string
  severity: MessageSeverity
}

const { statusType } = defineProps<{
  statusType: Status
}>()

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
    severity: 'error'
  },
  NodeVersionStatusBanned: {
    label: 'banned',
    severity: 'error'
  }
}

const statusLabel = computed(
  () => statusPropsMap[statusType]?.label || 'unknown'
)
const statusSeverity = computed(
  () => statusPropsMap[statusType]?.severity || 'secondary'
)
</script>
