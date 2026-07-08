<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Empty from '@/components/ui/empty/Empty.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
import EmptyDescription from '@/components/ui/empty/EmptyDescription.vue'
import EmptyHeader from '@/components/ui/empty/EmptyHeader.vue'
import EmptyMedia from '@/components/ui/empty/EmptyMedia.vue'
import EmptyTitle from '@/components/ui/empty/EmptyTitle.vue'
import type { AgentConversation } from '@/platform/agent/composables/useAgentChatPrototype'
import AgentChatHistoryGroupLabel from './AgentChatHistoryGroupLabel.vue'
import AgentChatHistoryItem from './AgentChatHistoryItem.vue'

const { conversations, activeId } = defineProps<{
  conversations: readonly AgentConversation[]
  activeId?: string | null
}>()

const emit = defineEmits<{
  back: []
  select: [id: string]
  delete: [id: string]
  copy: [id: string]
  newChat: []
}>()

type GroupKey = 'today' | 'yesterday' | 'last7Days' | 'last30Days'

interface Group {
  key: GroupKey
  labelKey: string
  items: AgentConversation[]
}

function getGroupKey(date: Date): GroupKey {
  const now = new Date()
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)

  if (diffDays < 1) return 'today'
  if (diffDays < 2) return 'yesterday'
  if (diffDays < 7) return 'last7Days'
  return 'last30Days'
}

const labelKeys: Record<GroupKey, string> = {
  today: 'agent.history.today',
  yesterday: 'agent.history.yesterday',
  last7Days: 'agent.history.last7Days',
  last30Days: 'agent.history.last30Days'
}

const order: GroupKey[] = ['today', 'yesterday', 'last7Days', 'last30Days']

const groups = computed<Group[]>(() => {
  const buckets: Record<GroupKey, AgentConversation[]> = {
    today: [],
    yesterday: [],
    last7Days: [],
    last30Days: []
  }

  for (const conv of conversations) {
    buckets[getGroupKey(conv.createdAt)].push(conv)
  }

  return order
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, labelKey: labelKeys[key], items: buckets[key] }))
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex shrink-0 items-center px-2 py-1.5">
      <Tooltip :delay-duration="300">
        <TooltipTrigger>
          <button
            type="button"
            class="flex h-6 cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-secondary-background-hover"
            :aria-label="$t('agent.history.back')"
            @click="emit('back')"
          >
            <i class="icon-[lucide--chevron-left] size-3" />
            <span>{{ $t('agent.history.title') }}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{{
          $t('agent.history.back')
        }}</TooltipContent>
      </Tooltip>
    </div>

    <div class="flex flex-1 flex-col overflow-y-auto p-2">
      <Empty v-if="groups.length === 0">
        <EmptyMedia variant="icon">
          <i class="icon-[lucide--history] size-5" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>{{ $t('agent.history.emptyTitle') }}</EmptyTitle>
          <EmptyDescription>{{
            $t('agent.history.emptyDescription')
          }}</EmptyDescription>
        </EmptyHeader>
        <Button variant="primary" size="lg" @click="emit('newChat')">
          {{ $t('agent.history.startChat') }}
        </Button>
      </Empty>

      <div v-for="group in groups" :key="group.key" class="mb-3">
        <AgentChatHistoryGroupLabel>{{
          $t(group.labelKey)
        }}</AgentChatHistoryGroupLabel>
        <ul class="flex list-none flex-col gap-0.5 pl-0">
          <AgentChatHistoryItem
            v-for="item in group.items"
            :key="item.id"
            :active="item.id === activeId"
            @select="emit('select', item.id)"
            @delete="emit('delete', item.id)"
            @copy="emit('copy', item.id)"
          >
            <span class="truncate">{{ item.title }}</span>
          </AgentChatHistoryItem>
        </ul>
      </div>
    </div>
  </div>
</template>
