<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import { formatRelativeTime } from '@/platform/workspace/utils/relativeTime'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

const { workflowPath, workflowName } = defineProps<{
  workflowPath: string
  workflowName: string
}>()

const emit = defineEmits<{ open: [] }>()

const { t } = useI18n()
const tabActivity = useWorkflowTabActivityStore()
const chats = computed(
  () => tabActivity.agentChatsByPath.get(workflowPath) ?? []
)
const countLabel = computed(() =>
  t('agent.workflowChatsCount', { workflowName }, chats.value.length)
)
const openedAt = ref(new Date())

function onOpenChange(open: boolean): void {
  if (!open) return
  openedAt.value = new Date()
  emit('open')
}

function lastActive(updatedAt: number): string {
  return formatRelativeTime(new Date(updatedAt), openedAt.value, {
    justNow: t('g.relativeTime.now'),
    minutesAgo: (count) => t('g.relativeTime.minutesAgo', { count }),
    hoursAgo: (count) => t('g.relativeTime.hoursAgo', { count }),
    daysAgo: (count) => t('g.relativeTime.daysAgo', { count })
  })
}

const items = computed<MenuItem[]>(() => [
  ...chats.value.map((chat) => ({
    label: chat.title,
    description: lastActive(chat.updatedAt),
    icon: 'icon-[lucide--message-square]',
    command: () => tabActivity.openAgentChat(workflowPath, chat.id)
  })),
  { separator: true },
  {
    label: t('agent.newChatOnWorkflow'),
    icon: 'icon-[lucide--plus]',
    command: () => tabActivity.openAgentChat(workflowPath, null)
  }
])
</script>

<template>
  <Menu
    v-if="chats.length"
    :items
    :label="t('agent.workflowChatsMenuLabel', { workflowName })"
    side="bottom"
    align="start"
    :side-offset="4"
    @update:open="onOpenChange"
  >
    <template #trigger>
      <Button
        :tooltip="countLabel"
        tooltip-side="bottom"
        variant="muted-textonly"
        size="unset"
        :aria-label="countLabel"
        class="absolute top-1/2 right-8 h-5 w-7 -translate-y-1/2 gap-0.5 rounded-sm text-xs tabular-nums"
        @click.stop
      >
        <i class="icon-[lucide--message-square] size-3 shrink-0" />
        {{ chats.length > 9 ? '9+' : chats.length }}
      </Button>
    </template>
  </Menu>
</template>
