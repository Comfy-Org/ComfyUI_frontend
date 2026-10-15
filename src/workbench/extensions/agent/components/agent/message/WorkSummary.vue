<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ActivityPart } from '../../../services/agent/agentMessageParts'
import { conversationFollowKey } from '../conversationFollow'

import ActivityTrace from './ActivityTrace.vue'

const { parts } = defineProps<{ parts: readonly ActivityPart[] }>()

const conversationFollow = inject(conversationFollowKey, undefined)

const { t } = useI18n()
</script>

<template>
  <CollapsibleRoot @update:open="conversationFollow?.pauseForTrace()">
    <CollapsibleTrigger
      class="group flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-sm leading-none font-normal text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground"
    >
      <span class="text-left">{{ t('agent.worked') }}</span>
      <span
        class="icon-[lucide--chevron-down] size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent
      class="agent-work-summary overflow-hidden"
      @animationend="conversationFollow?.traceSettled()"
    >
      <ActivityTrace :parts />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
