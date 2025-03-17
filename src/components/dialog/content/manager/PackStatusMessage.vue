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
    ></i>
    {{ $t(`manager.status.${statusLabel}`) }}
  </Message>
</template>

<script setup lang="ts">
import Message from 'primevue/message'
import { computed } from 'vue'

import { components } from '@/types/comfyRegistryTypes'
import { VueSeverity } from '@/types/primeVueTypes'

type PackVersionStatus = components['schemas']['NodeVersionStatus']
type PackStatus = components['schemas']['NodeStatus']
type Status = PackVersionStatus | PackStatus

type StatusProps = {
  label: string
  severity: VueSeverity
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
    severity: 'danger'
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
    severity: 'danger'
  },
  NodeVersionStatusBanned: {
    label: 'banned',
    severity: 'danger'
  }
}

const statusLabel = computed(
  () => statusPropsMap[statusType]?.label || 'unknown'
)
const statusSeverity = computed(
  () => statusPropsMap[statusType]?.severity || 'secondary'
)
</script>
