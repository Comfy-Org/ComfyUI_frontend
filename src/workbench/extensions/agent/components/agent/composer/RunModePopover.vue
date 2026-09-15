<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

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
const descriptionId = useId()
let openCount = 0

function onOpenChange(next: boolean): void {
  open.value = next
  if (next) openCount += 1
}

async function onSelectMode(value: string): Promise<void> {
  const match = options.find((option) => option.mode === value)
  if (!match || savingMode.value !== null) return

  const openedAs = openCount
  savingMode.value = match.mode
  try {
    await store.save(match.mode, null)
    if (openedAs === openCount) open.value = false
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
  <DropdownMenuRoot :open :modal="false" @update:open="onOpenChange">
    <DropdownMenuTrigger
      v-tooltip.top="buildTooltipConfig(triggerTooltip)"
      :class="
        cn(
          'flex h-8 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary-background-hover',
          open && 'bg-secondary-background-hover text-base-foreground'
        )
      "
    >
      <span>{{ triggerLabel }}</span>
      <span
        data-testid="run-mode-chevron"
        class="icon-[lucide--chevron-down] size-4"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        side="top"
        align="end"
        :side-offset="8"
        :aria-describedby="descriptionId"
        class="agent-scope z-1100 flex w-80 flex-col gap-2.5 rounded-[10px] border border-component-node-border bg-secondary-background p-2.5 shadow-lg outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <div class="flex flex-col gap-0.5">
          <div
            aria-hidden="true"
            class="text-sm/5 font-medium text-base-foreground"
          >
            {{ t('agent.runPermissions') }}
          </div>
          <div
            :id="descriptionId"
            aria-hidden="true"
            class="text-xs/4 text-muted-foreground"
          >
            {{ t('agent.runPermissionsDescription') }}
          </div>
        </div>

        <DropdownMenuRadioGroup
          :model-value="store.mode"
          :aria-label="t('agent.runPermissions')"
          class="flex flex-col gap-1"
          @update:model-value="onSelectMode"
        >
          <DropdownMenuRadioItem
            v-for="option in options"
            :key="option.mode"
            :value="option.mode"
            :disabled="savingMode !== null"
            :aria-busy="savingMode === option.mode || undefined"
            as-child
            @select.prevent
          >
            <button
              type="button"
              :class="
                cn(
                  'flex w-full cursor-pointer items-start gap-3 rounded-[10px] px-2.5 py-2 text-left whitespace-normal hover:bg-secondary-background-hover data-disabled:pointer-events-none',
                  store.mode === option.mode && 'bg-charcoal-500',
                  savingMode !== null &&
                    savingMode !== option.mode &&
                    'opacity-50'
                )
              "
            >
              <span
                :class="
                  cn(
                    'mt-0.5 size-4 shrink-0 text-muted-foreground',
                    option.icon
                  )
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
                aria-hidden="true"
                :class="
                  cn(
                    'mt-0.5 size-4 shrink-0',
                    savingMode === option.mode
                      ? 'icon-[lucide--loader-circle] text-muted-foreground motion-safe:animate-spin'
                      : store.mode === option.mode &&
                          'icon-[lucide--check] text-base-foreground'
                  )
                "
              />
            </button>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
      <span v-if="open" role="status" class="sr-only">
        {{ savingMode === null ? '' : t('g.saving') }}
      </span>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
