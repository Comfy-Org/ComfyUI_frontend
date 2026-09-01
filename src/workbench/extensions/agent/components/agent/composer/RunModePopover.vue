<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  RadioGroupItem,
  RadioGroupRoot
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildAgentTooltipConfig } from '@/composables/useTooltipConfig'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

import type { AgentRunMode } from '../../../stores/agent/agentRunModeStore'
import { useAgentRunModeStore } from '../../../stores/agent/agentRunModeStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const store = useAgentRunModeStore()
const toast = useToastStore()

const open = ref(false)
const saving = ref(false)
const draftMode = ref<AgentRunMode>(store.mode)
const draftLimit = ref(store.creditLimit)

function onOpenChange(next: boolean): void {
  open.value = next
  if (next) {
    draftMode.value = store.mode
    draftLimit.value = store.creditLimit
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
  () => draftMode.value !== store.mode || draftLimit.value !== store.creditLimit
)

const limitValid = computed(() => {
  if (draftMode.value !== 'auto_limited') return true
  const limit = draftLimit.value
  return limit !== null && Number.isInteger(limit) && limit > 0
})

const saveable = computed(
  () => dirty.value && limitValid.value && !saving.value
)

const TRIGGER_LABEL_KEYS: Record<AgentRunMode, string> = {
  ask_approval: 'agent.runModeTriggerAsk',
  auto: 'agent.runModeTriggerAuto',
  auto_limited: 'agent.runModeTriggerAutoLimit'
}

const triggerLabel = computed(() => t(TRIGGER_LABEL_KEYS[store.mode]))

const TRIGGER_TOOLTIP_KEYS: Record<AgentRunMode, string> = {
  ask_approval: 'agent.runModeTriggerAskTooltip',
  auto: 'agent.runModeTriggerAutoTooltip',
  auto_limited: 'agent.runModeTriggerAutoLimitTooltip'
}

const triggerTooltip = computed(() => t(TRIGGER_TOOLTIP_KEYS[store.mode]))

const options: {
  mode: AgentRunMode
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
  },
  {
    mode: 'auto_limited',
    icon: 'icon-[lucide--gauge]',
    title: 'agent.runModeLimit',
    description: 'agent.runModeLimitDescription'
  }
]
</script>

<template>
  <PopoverRoot :open @update:open="onOpenChange">
    <PopoverTrigger
      v-tooltip.top="buildAgentTooltipConfig(triggerTooltip)"
      :class="
        cn(
          'text-agent-fg-muted hover:bg-agent-surface-hover flex h-8 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs transition-colors',
          open && 'bg-agent-surface-hover text-agent-fg'
        )
      "
    >
      <span>{{ triggerLabel }}</span>
      <span class="icon-[lucide--chevron-down] size-3" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="top"
        align="end"
        :side-offset="8"
        class="agent-scope border-agent-border bg-agent-surface-raised z-1100 flex w-80 flex-col gap-2.5 rounded-[10px] border p-2.5 shadow-lg"
      >
        <div class="flex flex-col gap-0.5">
          <div class="text-agent-fg text-sm/5 font-medium">
            {{ t('agent.runPermissions') }}
          </div>
          <div class="text-agent-fg-muted text-xs/4">
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
                'rounded-[10px]',
                draftMode === option.mode && 'bg-charcoal-500'
              )
            "
          >
            <RadioGroupItem
              :value="option.mode"
              class="hover:bg-agent-surface-hover flex w-full cursor-pointer items-start gap-3 rounded-[10px] px-2.5 py-2 text-left"
            >
              <span
                :class="
                  cn('text-agent-fg-muted mt-0.5 size-4 shrink-0', option.icon)
                "
              />
              <span class="min-w-0 flex-1">
                <span class="text-agent-fg block text-sm/5">
                  {{ t(option.title) }}
                </span>
                <span class="text-agent-fg-muted mt-0.5 block text-xs/4">
                  {{ t(option.description) }}
                </span>
              </span>
              <span
                :class="
                  cn(
                    'mt-0.5 size-4 shrink-0',
                    draftMode === option.mode &&
                      'text-agent-fg icon-[lucide--check]'
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
              <input
                v-model.number="draftLimit"
                type="number"
                min="1"
                :aria-label="t('agent.credits')"
                class="border-agent-border text-agent-fg focus:border-agent-fg-muted h-8 min-w-0 flex-1 rounded-[10px] border bg-transparent px-2.5 text-sm/5 outline-none"
              />
              <span class="text-agent-fg-muted text-xs/4">
                {{ t('agent.credits') }}
              </span>
            </div>
          </div>
        </RadioGroupRoot>

        <button
          type="button"
          :disabled="!saveable"
          class="bg-agent-fg text-agent-surface hover:bg-agent-fg/90 h-8 w-full cursor-pointer rounded-[10px] text-sm/5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          @click="saveChanges"
        >
          {{ t('agent.saveChanges') }}
        </button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
