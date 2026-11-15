<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
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
</script>

<template>
  <CollapsibleRoot>
    <CollapsibleTrigger as-child>
      <Button
        variant="muted-textonly"
        size="md"
        class="group w-full justify-start"
      >
        <i
          v-if="unconfirmedCanvasWrite"
          aria-hidden="true"
          class="icon-[lucide--triangle-alert]"
          data-testid="agent-canvas-unconfirmed"
        />
        <span class="text-left">{{
          unconfirmedCanvasWrite
            ? t('agent.workedNotConfirmedOnCanvas')
            : t('agent.worked')
        }}</span>
        <i
          aria-hidden="true"
          class="icon-[lucide--chevron-down] transition-transform group-data-[state=open]:rotate-180"
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
