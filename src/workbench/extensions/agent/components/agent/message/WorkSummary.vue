<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { totalDurationMs } from '../../../services/agent/agentActivityRows'
import type { ActivityPart } from '../../../services/agent/agentMessageParts'
import {
  MS_PER_MINUTE,
  splitMinutes,
  tenthsOfSecond
} from '../../../utils/formatDuration'

import ActivityTrace from './ActivityTrace.vue'

const { parts } = defineProps<{ parts: readonly ActivityPart[] }>()

const { t } = useI18n()

const totalMs = computed(() => totalDurationMs(parts))

const label = computed(() => {
  if (totalMs.value <= 0) return t('agent.worked')
  if (totalMs.value < MS_PER_MINUTE)
    return t('agent.workedForSeconds', {
      seconds: tenthsOfSecond(totalMs.value)
    })
  return t('agent.workedForMinutes', splitMinutes(totalMs.value))
})
</script>

<template>
  <CollapsibleRoot>
    <CollapsibleTrigger
      class="group flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-sm leading-none font-normal text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground"
    >
      <span class="text-left">{{ label }}</span>
      <span
        class="icon-[lucide--chevron-down] size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent class="agent-work-summary overflow-hidden">
      <ActivityTrace :parts />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
