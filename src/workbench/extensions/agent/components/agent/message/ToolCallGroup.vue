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

const { tools } = defineProps<{ tools: ToolPart[] }>()

const { t } = useI18n()

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
        t('agent.ranToolCalls', tools.length)
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
        />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
