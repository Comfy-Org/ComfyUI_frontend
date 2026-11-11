<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import Badge from '@comfyorg/design-system/badge/Badge'
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const emit = defineEmits<{
  startTour: []
}>()

const { t } = useI18n()
const { experience } = storeToRefs(useAgentPanelStore())
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="flex items-center gap-1">
      <h1
        id="agent-panel-title"
        data-testid="agent-panel-title"
        :class="
          cn(
            'my-0 text-sm font-normal whitespace-nowrap',
            experience === 'redesign' && 'flex items-center gap-1.5'
          )
        "
      >
        <template v-if="experience === 'redesign'">
          <img
            src="/assets/images/comfy-logo-wordmark.svg"
            :alt="t('agent.brandWordmarkAlt')"
            width="173"
            height="48"
            draggable="false"
            class="h-4 w-auto shrink-0"
          />
          {{ t('agent.brandName') }}
        </template>
        <template v-else>{{ t('agent.title') }}</template>
      </h1>
      <Button
        :tooltip="t('agent.takeTour')"
        tooltip-side="bottom"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('agent.takeTour')"
        class="size-6 shrink-0"
        @click="emit('startTour')"
      >
        <i aria-hidden="true" class="icon-[lucide--info]" />
      </Button>
    </div>
    <Badge
      variant="pill"
      class="border bg-transparent text-xs text-muted-foreground"
    >
      {{ t('agent.beta') }}
    </Badge>
  </div>
</template>
