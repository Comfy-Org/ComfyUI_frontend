<script setup lang="ts">
import { PopoverTrigger, RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

import type { AgentRunModeValue } from '../../../stores/agent/agentRunModeStore'
import {
  DEFAULT_CREDIT_LIMIT,
  useAgentRunModeStore
} from '../../../stores/agent/agentRunModeStore'

const { t } = useI18n()
const store = useAgentRunModeStore()
const toast = useToastStore()

const open = ref(false)
const saving = ref(false)
const draftMode = ref<AgentRunModeValue>(store.mode)
const draftLimit = ref(store.creditLimit ?? DEFAULT_CREDIT_LIMIT)

function onOpenChange(next: boolean): void {
  open.value = next
  if (next) {
    draftMode.value = store.mode
    draftLimit.value = store.creditLimit ?? DEFAULT_CREDIT_LIMIT
  }
}

async function saveChanges(): Promise<void> {
  saving.value = true
  try {
    await store.save(
      draftMode.value,
      draftMode.value === 'auto_limited' ? draftLimit.value : null
    )
    open.value = false
  } catch (error) {
    reportError(error, { errorType: 'agent_run_mode_save_failure' })
    toast.add({ severity: 'error', detail: t('agent.runModeSaveFailed') })
  } finally {
    saving.value = false
  }
}

function onDraftMode(value: string | undefined): void {
  const match = options.find((option) => option.mode === value)
  if (match) draftMode.value = match.mode
}

const dirty = computed(
  () =>
    draftMode.value !== store.mode ||
    (draftMode.value === 'auto_limited' &&
      draftLimit.value !== store.creditLimit)
)

const limitValid = computed(() => {
  if (draftMode.value !== 'auto_limited') return true
  const limit = draftLimit.value
  return limit !== null && Number.isInteger(limit) && limit > 0
})

const saveable = computed(
  () => dirty.value && limitValid.value && !saving.value
)

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
  <Popover :open @update:open="onOpenChange">
    <PopoverTrigger
      v-tooltip.top="buildTooltipConfig(triggerTooltip)"
      :class="
        cn(
          'flex h-8 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary-background-hover',
          open && 'bg-secondary-background-hover text-base-foreground'
        )
      "
    >
      <span>{{ triggerLabel }}</span>
      <span class="icon-[lucide--chevron-down] size-3" />
    </PopoverTrigger>
    <PopoverContent
      side="top"
      align="end"
      :side-offset="8"
      class="agent-scope z-1100 flex w-80 flex-col gap-2.5 rounded-lg border-border-default bg-secondary-background p-2.5 shadow-lg"
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
        :model-value="draftMode"
        :aria-label="t('agent.runPermissions')"
        class="flex flex-col gap-1"
        @update:model-value="onDraftMode"
      >
        <div
          v-for="option in options"
          :key="option.mode"
          :class="
            cn(
              'rounded-lg',
              draftMode === option.mode && 'bg-tertiary-background'
            )
          "
        >
          <RadioGroupItem
            :value="option.mode"
            class="flex w-full cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-secondary-background-hover"
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
                  draftMode === option.mode &&
                    'icon-[lucide--check] text-base-foreground'
                )
              "
            />
          </RadioGroupItem>
          <div
            v-if="
              option.mode === 'auto_limited' && draftMode === 'auto_limited'
            "
            class="flex items-center gap-3 px-9.5 pb-2.5"
          >
            <Input
              v-model.number="draftLimit"
              type="number"
              min="1"
              :aria-label="t('agent.credits')"
              class="h-8 flex-1 px-2.5 text-sm/5"
            />
            <span class="text-xs/4 text-muted-foreground">
              {{ t('agent.credits') }}
            </span>
          </div>
        </div>
      </RadioGroupRoot>

      <Button
        variant="inverted"
        :disabled="!saveable"
        class="w-full"
        @click="saveChanges"
      >
        {{ t('agent.saveChanges') }}
      </Button>
    </PopoverContent>
  </Popover>
</template>
