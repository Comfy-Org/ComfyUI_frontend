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
        class="group w-full justify-start text-sm leading-none font-normal hover:text-foreground"
      >
        <span class="text-left">{{ t('agent.worked') }}</span>
        <span
          class="icon-[lucide--chevron-down] size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
        />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent
      class="overflow-hidden data-[state=closed]:motion-safe:animate-collapsible-up data-[state=open]:motion-safe:animate-collapsible-down"
    >
      <ActivityTrace :parts />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
