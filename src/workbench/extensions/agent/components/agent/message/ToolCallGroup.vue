<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ToolPart } from '../../../services/agent/agentMessageParts'

import ToolCallCard from './ToolCallCard.vue'

const { tools, streaming = false } = defineProps<{
  tools: ToolPart[]
  streaming?: boolean
}>()

const { t } = useI18n()

interface Row {
  name: string
  state: ToolPart['state']
  ok?: boolean
  count: number
  durationMs?: number
}
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  for (const tool of tools) {
    const prev = out.at(-1)
    if (prev && prev.name === tool.name) {
      prev.count += 1
      if (tool.state === 'streaming') prev.state = 'streaming'
      if (tool.ok === false) prev.ok = false
      if (tool.durationMs !== undefined)
        prev.durationMs = (prev.durationMs ?? 0) + tool.durationMs
    } else {
      out.push({
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
  const ms = tools.reduce((sum, tool) => sum + (tool.durationMs ?? 0), 0)
  return ms > 0 ? (ms / 1000).toFixed(1) : null
})

const running = computed(() => tools.some((tool) => tool.state === 'streaming'))
const failed = computed(() =>
  tools.some((tool) => tool.state === 'done' && tool.ok === false)
)

// Live tool events arrive only on completion, so per-tool streaming never
// occurs on real turns; the turn's own streaming flag keeps the list open
// while the agent works and collapses it when the turn settles.
const open = ref(true)
watch(
  () => streaming || running.value || failed.value,
  (stayOpen) => {
    open.value = stayOpen
  },
  { immediate: true }
)
</script>

<template>
  <CollapsibleRoot v-model:open="open">
    <CollapsibleTrigger
      class="group text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-sm transition-colors"
    >
      <span
        v-if="running"
        class="text-agent-fg-subtle icon-[lucide--loader-circle] size-4 shrink-0 animate-spin"
      />
      <span
        v-else-if="failed"
        class="text-agent-danger icon-[lucide--circle-x] size-4 shrink-0"
      />
      <span v-else class="icon-[lucide--wrench] size-4 shrink-0" />
      <span class="flex-1 text-left">{{
        totalSeconds === null
          ? t('agent.ranToolCalls', tools.length)
          : t(
              'agent.ranToolCallsTimed',
              { seconds: totalSeconds },
              tools.length
            )
      }}</span>
      <span
        class="icon-[lucide--chevron-down] size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent
      class="data-[state=closed]:animate-agent-collapsible-up data-[state=open]:animate-agent-collapsible-down overflow-hidden"
    >
      <div class="border-agent-border ml-4 flex flex-col gap-0.5 border-l pt-1">
        <ToolCallCard
          v-for="(row, index) in rows"
          :key="index"
          :name="row.name"
          :state="row.state"
          :ok="row.ok"
          :count="row.count"
          :duration-ms="row.durationMs"
        />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
