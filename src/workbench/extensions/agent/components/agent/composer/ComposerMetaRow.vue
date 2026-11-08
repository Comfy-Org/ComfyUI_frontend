<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import { openFeedbackDialog } from '@/workbench/extensions/agent/feedback'
import { useAgentOutputsTrayStore } from '@/workbench/extensions/agent/stores/agent/agentOutputsTrayStore'
import RunModePopover from './RunModePopover.vue'

const { canOpenOutputs = false } = defineProps<{
  canOpenOutputs?: boolean
}>()

const { t } = useI18n()
const tray = useAgentOutputsTrayStore()
</script>

<template>
  <div
    role="group"
    :aria-label="t('agent.chatSettings')"
    data-testid="composer-meta-row"
    class="flex items-center gap-1 px-1"
  >
    <div class="flex min-w-0 flex-1 items-center">
      <slot name="target" />
    </div>
    <Button
      v-if="canOpenOutputs"
      :tooltip="t('agent.outputs.title')"
      tooltip-side="top"
      type="button"
      variant="muted-textonly"
      size="md"
      :aria-label="t('agent.outputs.toggle')"
      :aria-expanded="tray.isOpen"
      :class="
        cn('shrink-0 gap-1.5', tray.isOpen && 'bg-accent text-foreground')
      "
      @click="tray.dispatch({ type: tray.isOpen ? 'closed' : 'opened' })"
    >
      <i aria-hidden="true" class="icon-[lucide--images]" />
      <span class="hidden @min-[560px]:inline">
        {{ t('agent.outputs.toggle') }}
      </span>
    </Button>
    <Button
      :tooltip="t('agent.feedbackCaption')"
      tooltip-side="top"
      type="button"
      variant="muted-textonly"
      size="md"
      :aria-label="t('agent.feedbackCaption')"
      class="shrink-0 gap-1.5"
      @click="openFeedbackDialog('agent-panel')"
    >
      <i aria-hidden="true" class="icon-[lucide--message-square]" />
      <span class="hidden @min-[560px]:inline">
        {{ t('agent.feedbackCaption') }}
      </span>
    </Button>
    <RunModePopover />
  </div>
</template>
