<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PartState } from '../../../services/agent/agentMessageParts'
import { cn } from '@comfyorg/tailwind-utils'

const {
  name,
  state,
  ok,
  count = 1
} = defineProps<{
  name: string
  state: PartState
  ok?: boolean
  count?: number
}>()

const { t } = useI18n()

const FRIENDLY_TOOL_KEYS: Record<string, string> = {
  new_tab: 'agent.toolOpenedNewTab',
  switch_tab: 'agent.toolSwitchedTabs',
  remember: 'agent.toolSavedPreference',
  forget: 'agent.toolForgotPreference'
}

const friendlyKey = computed(() =>
  Object.hasOwn(FRIENDLY_TOOL_KEYS, name) ? FRIENDLY_TOOL_KEYS[name] : undefined
)

const label = computed(() =>
  friendlyKey.value === undefined ? name : t(friendlyKey.value)
)

const glyph = computed(() => {
  if (state === 'streaming') return 'animate-spin icon-[lucide--loader-circle]'
  return ok === false
    ? 'icon-[lucide--circle-x]'
    : 'icon-[lucide--circle-check]'
})

const glyphColor = computed(() => {
  if (state === 'streaming') return 'text-agent-fg-subtle'
  return ok === false ? 'text-agent-danger' : 'text-agent-success'
})
</script>

<template>
  <div class="text-agent-fg flex items-center gap-2 px-3 py-1.5 text-sm">
    <span :class="cn('size-4 shrink-0', glyph, glyphColor)" />
    <span
      :class="cn('truncate text-xs', friendlyKey === undefined && 'font-mono')"
      >{{ label }}</span
    >
    <span v-if="count > 1" class="text-agent-fg-subtle text-xs"
      >×{{ count }}</span
    >
  </div>
</template>
