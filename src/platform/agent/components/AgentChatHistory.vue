<script setup lang="ts">
import { computed } from 'vue'

import type { AgentConversation } from '@/platform/agent/composables/useAgentChatPrototype'
import AgentChatHistoryGroupLabel from './AgentChatHistoryGroupLabel.vue'
import AgentChatHistoryItem from './AgentChatHistoryItem.vue'

const { conversations, currentTitle } = defineProps<{
  conversations: readonly AgentConversation[]
  currentTitle?: string
}>()

const emit = defineEmits<{
  back: []
  select: [id: string]
}>()

type GroupKey = 'current' | 'today' | 'yesterday' | 'last7Days' | 'last30Days'

interface Group {
  key: GroupKey
  labelKey: string
  items: AgentConversation[]
}

function getGroupKey(date: Date): Exclude<GroupKey, 'current'> {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 1) return 'today'
  if (diffDays < 2) return 'yesterday'
  if (diffDays < 7) return 'last7Days'
  return 'last30Days'
}

const groups = computed<Group[]>(() => {
  const buckets: Record<Exclude<GroupKey, 'current'>, AgentConversation[]> = {
    today: [],
    yesterday: [],
    last7Days: [],
    last30Days: []
  }

  for (const conv of conversations) {
    const key = getGroupKey(conv.createdAt)
    buckets[key].push(conv)
  }

  const result: Group[] = []

  if (currentTitle) {
    result.push({
      key: 'current',
      labelKey: 'agent.history.current',
      items: [{ id: 'current', title: currentTitle, createdAt: new Date() }]
    })
  }

  const order: Exclude<GroupKey, 'current'>[] = [
    'today',
    'yesterday',
    'last7Days',
    'last30Days'
  ]
  const labelKeys: Record<Exclude<GroupKey, 'current'>, string> = {
    today: 'agent.history.today',
    yesterday: 'agent.history.yesterday',
    last7Days: 'agent.history.last7Days',
    last30Days: 'agent.history.last30Days'
  }

  for (const key of order) {
    if (buckets[key].length > 0) {
      result.push({ key, labelKey: labelKeys[key], items: buckets[key] })
    }
  }

  return result
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex shrink-0 items-center px-2 py-1.5">
      <button
        type="button"
        class="flex h-6 items-center gap-1 rounded-sm border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-secondary-background-hover"
        @click="emit('back')"
      >
        <i class="icon-[lucide--arrow-left] size-3" />
        <span>{{ $t('agent.history.title') }}</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-2">
      <div v-for="group in groups" :key="group.key" class="mb-3">
        <AgentChatHistoryGroupLabel>{{
          $t(group.labelKey)
        }}</AgentChatHistoryGroupLabel>
        <ul class="flex list-none flex-col gap-0.5 pl-0">
          <AgentChatHistoryItem
            v-for="item in group.items"
            :key="item.id"
            :active="group.key === 'current'"
            @select="emit('select', item.id)"
          >
            <span class="truncate">{{ item.title }}</span>
          </AgentChatHistoryItem>
        </ul>
      </div>
    </div>
  </div>
</template>
