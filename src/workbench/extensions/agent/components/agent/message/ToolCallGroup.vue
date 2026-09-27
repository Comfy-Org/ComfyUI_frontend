<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  ActivityPart,
  ToolPart
} from '../../../services/agent/agentMessageParts'

import ToolCallCard from './ToolCallCard.vue'

const { parts, active = false } = defineProps<{
  parts: ActivityPart[]
  active?: boolean
}>()

const { t } = useI18n()

interface ToolRow {
  kind: 'tool'
  name: string
  state: ToolPart['state']
  ok?: boolean
  count: number
  durationMs?: number
}
type Row = ToolRow | { kind: 'thinking'; text: string }

const tools = computed(() =>
  parts.filter((part): part is ToolPart => part.type === 'tool')
)
const thinking = computed(() => parts.find((part) => part.type === 'thinking'))
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  for (const part of parts) {
    if (part.type === 'thinking') {
      out.push({ kind: 'thinking', text: part.text })
      continue
    }
    const tool = part
    const prev = out.at(-1)
    if (prev?.kind === 'tool' && prev.name === tool.name) {
      prev.count += 1
      if (tool.state === 'streaming') prev.state = 'streaming'
      if (tool.ok === false) prev.ok = false
      if (tool.durationMs !== undefined)
        prev.durationMs = (prev.durationMs ?? 0) + tool.durationMs
    } else {
      out.push({
        kind: 'tool',
        name: tool.name,
        state: tool.state,
        ok: tool.ok,
        count: 1,
        durationMs: tool.durationMs
      })
    }
  }
  return out
})

const totalSeconds = computed(() => {
  const ms = tools.value.reduce((sum, tool) => sum + (tool.durationMs ?? 0), 0)
  return ms > 0 ? (ms / 1000).toFixed(1) : null
})

const running = computed(() =>
  tools.value.some((tool) => tool.state === 'streaming')
)
const failed = computed(() =>
  tools.value.some((tool) => tool.state === 'done' && tool.ok === false)
)
const isActive = computed(() => active || running.value)
const statusLabel = computed(() => {
  if (thinking.value) {
    if (isActive.value) return t('agent.thinking')
    return thinking.value.durationMs
      ? t('agent.thoughtTimed', {
          seconds: (thinking.value.durationMs / 1000).toFixed(1)
        })
      : t('agent.thought')
  }

  return totalSeconds.value === null
    ? t('agent.ranToolCalls', tools.value.length)
    : t(
        'agent.ranToolCallsTimed',
        { seconds: totalSeconds.value },
        tools.value.length
      )
})

const open = ref(true)
watch(
  () => isActive.value || failed.value,
  (stayOpen) => {
    open.value = stayOpen
  },
  { immediate: true }
)
</script>

<template>
  <CollapsibleRoot v-model:open="open">
    <CollapsibleTrigger
      class="group text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-sm leading-none font-normal transition-colors"
    >
      <span
        v-if="running"
        class="text-agent-fg-subtle icon-[lucide--loader-circle] size-4 shrink-0 animate-spin"
      />
      <span
        v-else-if="failed"
        class="text-agent-fg-subtle icon-[lucide--circle-x] size-4 shrink-0"
      />
      <span v-else-if="thinking" class="icon-[lucide--brain] size-4 shrink-0" />
      <span v-else class="icon-[lucide--wrench] size-4 shrink-0" />
      <span
        :class="cn('text-left', thinking && isActive && 'agent-shimmer-text')"
        >{{ statusLabel }}</span
      >
      <span
        class="icon-[lucide--chevron-down] size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent
      class="data-[state=closed]:animate-agent-collapsible-up data-[state=open]:animate-agent-collapsible-down overflow-hidden"
    >
      <div role="list" class="border-agent-border ml-4 flex flex-col border-l">
        <template v-for="(row, index) in rows" :key="index">
          <div
            v-if="row.kind === 'thinking'"
            role="listitem"
            class="text-agent-fg-muted ml-2 min-h-8 px-2 py-1 text-sm/5"
          >
            <span>{{ row.text }}</span>
          </div>
          <ToolCallCard
            v-else
            :name="row.name"
            :state="row.state"
            :ok="row.ok"
            :count="row.count"
            :duration-ms="row.durationMs"
          />
        </template>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
