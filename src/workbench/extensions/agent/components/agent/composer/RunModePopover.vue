<script setup lang="ts">
import { DropdownMenuRadioGroup } from 'reka-ui'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import MenuItemContent from '@/components/ui/menu/MenuItemContent.vue'
import MenuRadioItem from '@/components/ui/menu/MenuRadioItem.vue'
import { selectedMenuButtonClass } from '@/components/ui/menu/menuStyles'
import { useToast } from '@/components/ui/toast/toastStore'
import { reportError } from '@/platform/telemetry/reportError'
import { useTelemetry } from '@/platform/telemetry'

import type { AgentRunModeValue } from '@/workbench/extensions/agent/stores/agent/agentRunModeStore'
import { useAgentRunModeStore } from '@/workbench/extensions/agent/stores/agent/agentRunModeStore'

const { t } = useI18n()
const store = useAgentRunModeStore()
const toast = useToast()

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
  const previousMode = store.mode
  savingMode.value = match.mode
  try {
    await store.save(match.mode, null)
    if (previousMode !== match.mode)
      useTelemetry()?.trackAgentRunModeChanged({
        from: previousMode,
        to: match.mode
      })
    if (openedAs === openCount) open.value = false
  } catch (error) {
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_run_mode_save_failure'
    })
    toast.error(t('agent.runModeSaveFailed'))
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
  <Menu
    :open
    :modal="false"
    side="top"
    align="end"
    :side-offset="8"
    :aria-describedby="descriptionId"
    class="agent-scope flex w-80 flex-col gap-1"
    @update:open="onOpenChange"
  >
    <template #trigger>
      <Button
        :tooltip="triggerTooltip"
        variant="muted-textonly"
        size="md"
        :class="cn('gap-1', open && 'bg-accent')"
      >
        <span>{{ triggerLabel }}</span>
        <span
          data-testid="run-mode-chevron"
          class="icon-[lucide--chevron-down] size-4"
        />
      </Button>
    </template>
    <div class="flex flex-col gap-0.5 px-3 py-1.5">
      <div aria-hidden="true" class="text-sm/5 text-foreground">
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
      class="flex flex-col gap-0.5"
      @update:model-value="typeof $event === 'string' && onSelectMode($event)"
    >
      <MenuRadioItem
        v-for="option in options"
        :key="option.mode"
        :value="option.mode"
        :disabled="savingMode !== null"
        :aria-busy="savingMode === option.mode || undefined"
        :class="
          cn(
            store.mode === option.mode && selectedMenuButtonClass,
            savingMode === option.mode && 'data-disabled:opacity-100'
          )
        "
        @select.prevent
      >
        <MenuItemContent
          :item="{
            label: t(option.title),
            description: t(option.description),
            icon: cn(option.icon, 'text-muted-foreground'),
            trailingIcon:
              savingMode === option.mode
                ? 'icon-[lucide--loader-circle] text-muted-foreground motion-safe:animate-spin'
                : undefined,
            checked:
              savingMode === option.mode
                ? undefined
                : store.mode === option.mode
          }"
          :has-submenu="false"
        />
      </MenuRadioItem>
    </DropdownMenuRadioGroup>
  </Menu>
  <span v-if="open" role="status" class="sr-only">
    {{ savingMode === null ? '' : t('g.saving') }}
  </span>
</template>
