<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useI18n } from 'vue-i18n'

import type {
  ResolvedTabPrimaryStatus,
  TabPrimaryStatus
} from './workflowTabStatus'

const { status, reserveSpace = true } = defineProps<{
  status?: ResolvedTabPrimaryStatus
  reserveSpace?: boolean
}>()

const { t } = useI18n()

const ICON_CLASSES: Partial<Record<TabPrimaryStatus, string>> = {
  failed: 'icon-[lucide--octagon-alert] text-destructive',
  busy: 'icon-[lucide--loader-circle] text-muted-foreground motion-safe:animate-spin',
  completed: 'icon-[lucide--circle-check] text-success'
}

const DOT_CLASSES: Partial<Record<TabPrimaryStatus, string>> = {
  waiting: 'bg-warning',
  unseen: 'bg-primary'
}
</script>

<template>
  <span
    v-if="status || reserveSpace"
    data-testid="workflow-tab-status-slot"
    class="inline-flex size-4 shrink-0 items-center justify-center"
    :aria-hidden="!status || undefined"
  >
    <i
      v-if="status && ICON_CLASSES[status.kind]"
      role="img"
      :aria-label="t(status.labelKey)"
      data-testid="workflow-tab-status"
      :data-status="status.kind"
      :class="ICON_CLASSES[status.kind]"
    />
    <span
      v-else-if="status && DOT_CLASSES[status.kind]"
      role="img"
      :aria-label="t(status.labelKey)"
      data-testid="workflow-tab-status"
      :data-status="status.kind"
      :class="cn('size-2 rounded-full', DOT_CLASSES[status.kind])"
    />
  </span>
</template>
