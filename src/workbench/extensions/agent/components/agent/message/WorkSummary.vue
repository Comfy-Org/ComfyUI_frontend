<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ActivityPart } from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import { isUnconfirmedCanvasWrite } from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import { toolCanMutateCanvas } from '@/workbench/extensions/agent/services/agent/agentToolClassification'

import ActivityTrace from './ActivityTrace.vue'

const { parts } = defineProps<{ parts: readonly ActivityPart[] }>()

const { t } = useI18n()

const unconfirmedCanvasWrite = computed(() =>
  parts.some(
    (part) =>
      part.type === 'tool' &&
      (isUnconfirmedCanvasWrite(part) ||
        (part.ok === true &&
          part.state === 'streaming' &&
          toolCanMutateCanvas(part.name)))
  )
)

const durationSeconds = computed(() => {
  const durationMs = parts.reduce(
    (total, part) => total + (part.durationMs ?? 0),
    0
  )
  return durationMs > 0 ? Math.ceil(durationMs / 1000) : undefined
})

const workedLabel = computed(() => {
  if (unconfirmedCanvasWrite.value) return t('agent.workedNotConfirmedOnCanvas')
  if (durationSeconds.value === undefined) return t('agent.worked')

  const minutes = Math.floor(durationSeconds.value / 60)
  const seconds = durationSeconds.value % 60
  return minutes > 0
    ? t('agent.workedForMinutes', { minutes, seconds })
    : t('agent.workedForSeconds', { seconds })
})
</script>

<template>
  <CollapsibleRoot>
    <CollapsibleTrigger
      class="group flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-sm leading-none font-normal text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <i
        v-if="unconfirmedCanvasWrite"
        aria-hidden="true"
        class="icon-[lucide--triangle-alert]"
        data-testid="agent-canvas-unconfirmed"
      />
      <span class="text-left">{{ workedLabel }}</span>
      <i
        aria-hidden="true"
        class="icon-[lucide--chevron-down] transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent class="agent-work-summary overflow-hidden">
      <ActivityTrace :parts />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
