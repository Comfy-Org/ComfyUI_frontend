<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PartState } from '../../../services/agent/agentMessageParts'
import { cn } from '@comfyorg/tailwind-utils'

const {
  name,
  state,
  ok,
  count = 1,
  durationMs
} = defineProps<{
  name: string
  state: PartState
  ok?: boolean
  count?: number
  durationMs?: number
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

const label = computed(() => {
  if (friendlyKey.value !== undefined) return t(friendlyKey.value)
  const spaced = name.replaceAll('_', ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
})

const glyph = computed(() => {
  if (state === 'streaming') return 'animate-spin icon-[lucide--loader-circle]'
  return ok === false
    ? 'icon-[lucide--circle-x]'
    : 'icon-[lucide--circle-check]'
})

const glyphColor = computed(() => {
  if (state === 'streaming') return 'text-agent-fg-subtle'
  return ok === false ? 'text-agent-danger' : 'text-agent-fg-subtle'
})
</script>

<template>
  <div class="text-agent-fg flex items-center gap-2 px-3 py-1.5 text-sm">
    <span :class="cn('size-4 shrink-0', glyph, glyphColor)" />
    <span class="truncate text-xs">{{ label }}</span>
    <span v-if="count > 1" class="text-agent-fg-subtle text-xs"
      >×{{ count }}</span
    >
    <span
      v-if="durationMs !== undefined"
      class="text-agent-fg-subtle ml-auto shrink-0 font-mono text-xs"
      >{{ (durationMs / 1000).toFixed(1) }}s</span
    >
  </div>
</template>
