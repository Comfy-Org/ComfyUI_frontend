<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import { computed } from 'vue'

import type { ActivityPart } from '../../../services/agent/agentMessageParts'

import ActivityTrace from './ActivityTrace.vue'

const { parts } = defineProps<{ parts: readonly ActivityPart[] }>()

const { t } = useI18n()

/**
 * PM-1343: the summary is the turn's own headline claim about its work, and
 * it is the one line the person reads without expanding anything. A turn that
 * wrote to the graph and was never observed to change the canvas must not
 * head itself "Worked" -- that is the false completion claim, in the panel's
 * own voice rather than the model's. Collapsed-by-default is exactly why this
 * belongs on the trigger and not only on the row inside.
 */
const unconfirmedCanvasWrite = computed(() =>
  parts.some(
    (part) =>
      part.type === 'tool' &&
      part.canvasConfirmed === false &&
      part.ok !== false
  )
)
</script>

<template>
  <CollapsibleRoot>
    <CollapsibleTrigger
      class="group flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-sm leading-none font-normal text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground"
    >
      <span
        v-if="unconfirmedCanvasWrite"
        class="icon-[lucide--triangle-alert] size-4 shrink-0"
        data-testid="agent-canvas-unconfirmed"
      />
      <span class="text-left">{{
        unconfirmedCanvasWrite
          ? t('agent.workedNotConfirmedOnCanvas')
          : t('agent.worked')
      }}</span>
      <span
        class="icon-[lucide--chevron-down] size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent class="agent-work-summary overflow-hidden">
      <ActivityTrace :parts />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
