<script setup lang="ts">
import { CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CollapsibleContent from '@/components/ui/CollapsibleContent.vue'
import type { ToolPart } from '@/services/agent/agentMessageParts'
import { cn } from '@/utils/cn'

import ToolCallCard from './ToolCallCard.vue'

const { tools } = defineProps<{ tools: ToolPart[] }>()

const { t } = useI18n()

// Consecutive identical tool names collapse into one row with a count (same-tool xN).
interface Row {
  name: string
  state: ToolPart['state']
  ok?: boolean
  count: number
}
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  for (const tool of tools) {
    const prev = out.at(-1)
    if (prev && prev.name === tool.name) {
      prev.count += 1
      if (tool.state === 'streaming') prev.state = 'streaming'
      if (tool.ok === false) prev.ok = false
    } else {
      out.push({
        name: tool.name,
        state: tool.state,
        ok: tool.ok,
        count: 1
      })
    }
  }
  return out
})

const running = computed(() => tools.some((tool) => tool.state === 'streaming'))
const failed = computed(() =>
  tools.some((tool) => tool.state === 'done' && tool.ok === false)
)

// Live while running or if anything failed; collapse once every call settled clean. Drive
// open BOTH ways off the source: a later tool re-entering the group (running again) or a
// tool failing must re-open it, not just the first clean settle. Manual re-open of a
// settled clean group still sticks because the source does not change then.
const open = ref(true)
watch(
  () => running.value || failed.value,
  (stayOpen) => {
    open.value = stayOpen
  },
  { immediate: true }
)
</script>

<template>
  <CollapsibleRoot
    v-model:open="open"
    class="rounded-agent border-agent-border bg-agent-surface border"
  >
    <CollapsibleTrigger
      class="group text-agent-fg-muted hover:text-agent-fg flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors"
    >
      <span
        class="icon-[lucide--chevron-right] size-3.5 transition-transform group-data-[state=open]:rotate-90"
      />
      <span
        v-if="running"
        class="text-agent-fg-subtle icon-[lucide--loader-circle] size-3.5 animate-spin"
      />
      <span
        v-else-if="failed"
        class="text-agent-danger icon-[lucide--circle-x] size-3.5"
      />
      <span
        v-else
        class="text-agent-success icon-[lucide--circle-check] size-3.5"
      />
      <span>{{ t('agent.ranToolCalls', tools.length) }}</span>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div
        :class="cn('divide-agent-border border-agent-border divide-y border-t')"
      >
        <ToolCallCard
          v-for="(row, index) in rows"
          :key="index"
          :name="row.name"
          :state="row.state"
          :ok="row.ok"
          :count="row.count"
        />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
