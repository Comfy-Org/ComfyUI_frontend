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

import { buildTooltipConfig } from '@/composables/useTooltipConfig'

import type { AgentRunMode } from '../../../stores/agent/agentRunModeStore'
import { useAgentRunModeStore } from '../../../stores/agent/agentRunModeStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const store = useAgentRunModeStore()

const open = ref(false)
const draftMode = ref<AgentRunMode>(store.mode)
const draftLimit = ref(store.creditLimit)

function onOpenChange(next: boolean): void {
  open.value = next
  if (next) {
    draftMode.value = store.mode
    draftLimit.value = store.creditLimit
  }
}

function saveChanges(): void {
  store.save(draftMode.value, draftLimit.value)
  open.value = false
}

function onDraftMode(value: string | undefined): void {
  const match = options.find((option) => option.mode === value)
  if (match) draftMode.value = match.mode
}

const dirty = computed(
  () => draftMode.value !== store.mode || draftLimit.value !== store.creditLimit
)

const triggerLabel = computed(() =>
  store.mode === 'ask' ? t('agent.runModeTriggerAsk') : t('agent.modelAuto')
)

const options: {
  mode: AgentRunMode
  icon: string
  title: string
  description: string
}[] = [
  {
    mode: 'ask',
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
    mode: 'auto-limit',
    icon: 'icon-[lucide--gauge]',
    title: 'agent.runModeLimit',
    description: 'agent.runModeLimitDescription'
  }
]
</script>

<template>
  <PopoverRoot :open @update:open="onOpenChange">
    <PopoverTrigger
      v-tooltip.top="buildTooltipConfig(t('agent.runPermissions'))"
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
        class="agent-scope rounded-agent border-agent-border bg-agent-surface-raised z-1100 w-72 border p-3 shadow-lg"
      >
        <div class="text-agent-fg text-sm font-medium">
          {{ t('agent.runPermissions') }}
        </div>
        <div class="text-agent-fg-muted mt-0.5 text-xs">
          {{ t('agent.runPermissionsDescription') }}
        </div>

        <RadioGroupRoot
          :model-value="draftMode"
          :aria-label="t('agent.runPermissions')"
          class="mt-3 flex flex-col gap-1"
          @update:model-value="onDraftMode"
        >
          <div v-for="option in options" :key="option.mode">
            <RadioGroupItem
              :value="option.mode"
              :class="
                cn(
                  'hover:bg-agent-surface-hover rounded-agent flex w-full cursor-pointer items-start gap-2.5 p-2 text-left',
                  draftMode === option.mode && 'bg-agent-surface-hover'
                )
              "
            >
              <span
                :class="
                  cn('text-agent-fg-muted mt-0.5 size-4 shrink-0', option.icon)
                "
              />
              <span class="min-w-0 flex-1">
                <span class="text-agent-fg block text-xs">
                  {{ t(option.title) }}
                </span>
                <span class="text-agent-fg-muted mt-0.5 block text-xs">
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
              v-if="option.mode === 'auto-limit' && draftMode === 'auto-limit'"
              class="flex items-center gap-2 px-2 pb-2 pl-8.5"
            >
              <input
                v-model.number="draftLimit"
                type="number"
                min="1"
                :aria-label="t('agent.credits')"
                class="border-agent-border bg-agent-surface text-agent-fg focus:border-agent-fg-muted w-24 rounded-md border px-2 py-1 text-xs outline-none"
              />
              <span class="text-agent-fg-muted text-xs">
                {{ t('agent.credits') }}
              </span>
            </div>
          </div>
        </RadioGroupRoot>

        <button
          type="button"
          :disabled="!dirty"
          class="bg-agent-fg text-agent-surface hover:bg-agent-fg/90 mt-3 w-full cursor-pointer rounded-md py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          @click="saveChanges"
        >
          {{ t('agent.saveChanges') }}
        </button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
