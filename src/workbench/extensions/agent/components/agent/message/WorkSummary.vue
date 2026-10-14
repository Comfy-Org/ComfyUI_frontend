<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { ActivityPart } from '../../../services/agent/agentMessageParts'

import ActivityTrace from './ActivityTrace.vue'

const { parts } = defineProps<{ parts: readonly ActivityPart[] }>()

const { t } = useI18n()
</script>

<template>
  <CollapsibleRoot>
    <CollapsibleTrigger as-child>
      <Button
        variant="muted-textonly"
        size="md"
        class="group w-full justify-start text-sm leading-none font-normal hover:text-base-foreground"
      >
        <span class="text-left">{{ t('agent.worked') }}</span>
        <span
          class="icon-[lucide--chevron-down] size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
        />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent class="agent-work-summary overflow-hidden">
      <ActivityTrace :parts />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
