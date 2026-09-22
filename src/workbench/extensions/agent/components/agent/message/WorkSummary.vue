<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import type { ActivityPart } from '../../../services/agent/agentMessageParts'

import ActivityTrace from './ActivityTrace.vue'

const { parts } = defineProps<{ parts: readonly ActivityPart[] }>()

const { t } = useI18n()
</script>

<template>
  <CollapsibleRoot>
    <CollapsibleTrigger
      class="group text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-sm leading-none font-normal transition-colors"
    >
      <span class="text-left">{{ t('agent.worked') }}</span>
      <span
        class="icon-[lucide--chevron-down] size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent
      class="data-[state=closed]:animate-agent-collapsible-up data-[state=open]:animate-agent-collapsible-down overflow-hidden"
    >
      <ActivityTrace :parts />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
