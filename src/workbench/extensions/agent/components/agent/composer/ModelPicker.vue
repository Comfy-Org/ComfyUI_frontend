<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { reportError } from '@/platform/telemetry/reportError'

import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentModelStore } from '@/workbench/extensions/agent/stores/agent/agentModelStore'

const { t } = useI18n()
const store = useAgentModelStore()
const conversationStore = useAgentConversationStore()

const open = ref(false)

function reload(): void {
  void store.load().catch((error: unknown) => {
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_model_list_load_failure'
    })
  })
}

function onOpenChange(next: boolean): void {
  open.value = next
  // The list depends on the login, which can change while the panel is open.
  if (next) reload()
}

const selected = computed(() => store.selectedFor(conversationStore.threadId))

const REASON_KEYS: Record<string, string> = {
  not_signed_in: 'agent.modelReasonNotSignedIn',
  sign_in_refused: 'agent.modelReasonSignInRefused',
  checking: 'agent.modelReasonChecking',
  not_available_for_account: 'agent.modelReasonNotForAccount',
  no_key: 'agent.modelReasonNoKey',
  setting_off: 'agent.modelReasonSettingOff'
}

/** Why the shown default can't be used, when it can't. */
const unavailableNote = computed(() => {
  const model = selected.value
  if (!model || model.available) return null
  const key = model.reason ? REASON_KEYS[model.reason] : undefined
  return t('agent.modelUnavailableNote', {
    model: model.label,
    reason: key ? t(key) : t('agent.modelReasonUnknown')
  })
})

const ROUTE_ICONS: Record<string, string> = {
  cloud: 'icon-[lucide--cloud]',
  local: 'icon-[lucide--monitor]',
  openrouter: 'icon-[lucide--globe]'
}

function iconFor(route: string): string {
  return ROUTE_ICONS[route] ?? 'icon-[lucide--sparkles]'
}

function onSelect(value: unknown): void {
  if (typeof value !== 'string') return
  if (!store.available.some((model) => model.id === value)) return
  store.select(conversationStore.threadId, value)
  open.value = false
}
</script>

<template>
  <DropdownMenuRoot
    v-if="store.supported && selected"
    :open
    :modal="false"
    @update:open="onOpenChange"
  >
    <DropdownMenuTrigger as-child>
      <Button
        data-testid="agent-model-picker"
        :tooltip="t('agent.modelPickerTooltip')"
        :aria-label="t('agent.modelPickerLabel', { model: selected.label })"
        variant="muted-textonly"
        size="md"
        :class="
          cn(
            'max-w-48 gap-1',
            open && 'bg-accent',
            !selected.available && 'text-muted-foreground'
          )
        "
      >
        <span
          :class="
            cn(
              'size-4 shrink-0',
              selected.available
                ? iconFor(selected.route)
                : 'icon-[lucide--triangle-alert] text-warning'
            )
          "
        />
        <span class="truncate">{{ selected.label }}</span>
        <span class="icon-[lucide--chevron-down] size-4 shrink-0" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal :key="Number(open)">
      <DropdownMenuContent
        side="top"
        align="end"
        :side-offset="8"
        class="agent-scope z-overlay flex w-72 flex-col gap-2 rounded-lg border bg-secondary p-2.5 text-foreground shadow-lg outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <div aria-hidden="true" class="text-sm/5 text-foreground">
          {{ t('agent.modelPickerTitle') }}
        </div>
        <div
          v-if="unavailableNote"
          data-testid="agent-model-unavailable-note"
          role="note"
          class="text-xs/4 text-muted-foreground"
        >
          {{ unavailableNote }}
        </div>
        <DropdownMenuRadioGroup
          :model-value="selected.id"
          :aria-label="t('agent.modelPickerTitle')"
          class="flex flex-col gap-1"
          @update:model-value="onSelect"
        >
          <DropdownMenuRadioItem
            v-for="model in store.available"
            :key="model.id"
            :value="model.id"
            as-child
            @select.prevent
          >
            <Button
              :data-testid="`agent-model-option-${model.id}`"
              :variant="
                selected.id === model.id ? 'tertiary' : 'muted-textonly'
              "
              size="unset"
              class="w-full items-center gap-3 px-2.5 py-2 text-left whitespace-normal"
            >
              <span
                :class="
                  cn(
                    'size-4 shrink-0 text-muted-foreground',
                    iconFor(model.route)
                  )
                "
              />
              <span class="min-w-0 flex-1 text-sm/5 text-foreground">{{
                model.label
              }}</span>
              <span
                aria-hidden="true"
                :class="
                  cn(
                    'size-4 shrink-0',
                    selected.id === model.id &&
                      'icon-[lucide--check] text-foreground'
                  )
                "
              />
            </Button>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
