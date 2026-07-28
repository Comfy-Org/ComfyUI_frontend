<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

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
      :aria-label="t('agent.runPermissions')"
      class="text-agent-fg-muted hover:bg-agent-surface-hover flex h-8 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs transition-colors"
    >
      <span>{{ t('agent.modelAuto') }}</span>
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

        <div
          role="radiogroup"
          :aria-label="t('agent.runPermissions')"
          class="mt-3 flex flex-col gap-1"
        >
          <div
            v-for="option in options"
            :key="option.mode"
            :class="
              cn(
                'rounded-agent',
                draftMode === option.mode && 'border-agent-border border'
              )
            "
          >
            <button
              type="button"
              role="radio"
              :aria-checked="draftMode === option.mode"
              class="hover:bg-agent-surface-hover rounded-agent flex w-full cursor-pointer items-start gap-2.5 p-2 text-left"
              @click="draftMode = option.mode"
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
                v-if="draftMode === option.mode"
                class="text-agent-fg mt-0.5 icon-[lucide--check] size-4 shrink-0"
              />
            </button>
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
        </div>

        <button
          type="button"
          class="bg-agent-fg text-agent-surface hover:bg-agent-fg/90 mt-3 w-full cursor-pointer rounded-md py-1.5 text-xs font-medium transition-colors"
          @click="saveChanges"
        >
          {{ t('agent.saveChanges') }}
        </button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
