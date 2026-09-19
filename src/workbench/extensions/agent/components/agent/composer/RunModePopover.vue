<script setup lang="ts">
import { PopoverTrigger, RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

import type { AgentRunModeValue } from '../../../stores/agent/agentRunModeStore'
import { useAgentRunModeStore } from '../../../stores/agent/agentRunModeStore'

const { t } = useI18n()
const store = useAgentRunModeStore()
const toast = useToastStore()

const open = ref(false)
const savingMode = ref<AgentRunModeValue | null>(null)
const selectedMode = computed(() => savingMode.value ?? store.mode)

async function onSelectMode(value: string | undefined): Promise<void> {
  const match = options.find((option) => option.mode === value)
  if (!match || savingMode.value !== null) return
  if (match.mode === store.mode) {
    open.value = false
    return
  }

  savingMode.value = match.mode
  try {
    await store.save(match.mode, null)
    open.value = false
  } catch (error) {
    reportError(error, { errorType: 'agent_run_mode_save_failure' })
    toast.add({ severity: 'error', detail: t('agent.runModeSaveFailed') })
  } finally {
    savingMode.value = null
  }
}

const TRIGGER_LABEL_KEYS: Record<AgentRunModeValue, string> = {
  ask_approval: 'agent.runModeTriggerAsk',
  auto: 'agent.runModeTriggerAuto',
  auto_limited: 'agent.runModeTriggerAutoLimit'
}

const triggerLabel = computed(() => t(TRIGGER_LABEL_KEYS[store.mode]))

const TRIGGER_TOOLTIP_KEYS: Record<AgentRunModeValue, string> = {
  ask_approval: 'agent.runModeTriggerAskTooltip',
  auto: 'agent.runModeTriggerAutoTooltip',
  auto_limited: 'agent.runModeTriggerAutoLimitTooltip'
}

const triggerTooltip = computed(() => t(TRIGGER_TOOLTIP_KEYS[store.mode]))

const options: {
  mode: AgentRunModeValue
  icon: string
  title: string
  description: string
}[] = [
  {
    mode: 'ask_approval',
    icon: 'icon-[lucide--hand]',
    title: 'agent.runModeAsk',
    description: 'agent.runModeAskDescription'
  },
  {
    mode: 'auto',
    icon: 'icon-[lucide--zap]',
    title: 'agent.runModeAuto',
    description: 'agent.runModeAutoDescription'
  }
]
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        v-tooltip.top="buildTooltipConfig(triggerTooltip)"
        variant="muted-textonly"
        size="md"
        :class="cn('gap-1', open && 'bg-secondary-background-hover')"
      >
        <span>{{ triggerLabel }}</span>
        <span
          data-testid="run-mode-chevron"
          class="icon-[lucide--chevron-down] size-4"
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      side="top"
      align="end"
      :side-offset="8"
      class="agent-scope z-1100 flex w-80 flex-col gap-2.5 rounded-lg border-border-default bg-secondary-background p-2.5 shadow-lg"
      @escape-key-down="open = false"
    >
      <div class="flex flex-col gap-0.5">
        <div class="text-sm/5 font-medium text-base-foreground">
          {{ t('agent.runPermissions') }}
        </div>
        <div class="text-xs/4 text-muted-foreground">
          {{ t('agent.runPermissionsDescription') }}
        </div>
      </div>

      <RadioGroupRoot
        :model-value="selectedMode"
        :aria-label="t('agent.runPermissions')"
        class="flex flex-col gap-1"
        @update:model-value="onSelectMode"
      >
        <RadioGroupItem
          v-for="option in options"
          :key="option.mode"
          :value="option.mode"
          as-child
        >
          <Button
            :variant="
              selectedMode === option.mode ? 'tertiary' : 'muted-textonly'
            "
            size="unset"
            class="w-full items-start gap-3 px-2.5 py-2 text-left whitespace-normal"
          >
            <span
              :class="
                cn('mt-0.5 size-4 shrink-0 text-muted-foreground', option.icon)
              "
            />
            <span class="min-w-0 flex-1">
              <span class="block text-sm/5 text-base-foreground">
                {{ t(option.title) }}
              </span>
              <span class="mt-0.5 block text-xs/4 text-muted-foreground">
                {{ t(option.description) }}
              </span>
            </span>
            <span
              :class="
                cn(
                  'mt-0.5 size-4 shrink-0',
                  selectedMode === option.mode &&
                    'icon-[lucide--check] text-base-foreground'
                )
              "
            />
          </Button>
        </RadioGroupItem>
      </RadioGroupRoot>
    </PopoverContent>
  </Popover>
</template>
