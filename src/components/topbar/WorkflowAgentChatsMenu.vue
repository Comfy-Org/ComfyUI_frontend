<script lang="ts">
// Hover can open one menu while another one, opened from the keyboard, is
// still open, so opening a menu closes whichever one is open.
let closeOpenMenu: (() => void) | undefined
</script>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useTimeoutFn } from '@vueuse/core'
import type { HTMLAttributes } from 'vue'
import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import { formatRelativeTime } from '@/platform/workspace/utils/relativeTime'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

const HOVER_OPEN_DELAY_MS = 200
const HOVER_CLOSE_DELAY_MS = 150

const {
  workflowPath,
  workflowName,
  class: className
} = defineProps<{
  workflowPath: string
  workflowName: string
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{ open: [] }>()

const { t } = useI18n()
const tabActivity = useWorkflowTabActivityStore()
const chats = computed(
  () => tabActivity.agentChatsByPath.get(workflowPath) ?? []
)
const chatsLabel = computed(() =>
  t('agent.workflowChatsCount', { workflowName }, chats.value.length)
)
const openedAt = ref(new Date())
const open = ref(false)
// Hover opens and closes the menu without moving focus.
let changedByHover = false
// Clicking the trigger of a hover-opened menu keeps it open instead of toggling.
let keepOpenOnClick = false

const hoverOpenTimer = useTimeoutFn(
  () => setOpen(true, true),
  HOVER_OPEN_DELAY_MS,
  { immediate: false }
)
const hoverCloseTimer = useTimeoutFn(
  () => setOpen(false, true),
  HOVER_CLOSE_DELAY_MS,
  { immediate: false }
)

function close(): void {
  setOpen(false)
}

function setOpen(next: boolean, byHover = false): void {
  hoverOpenTimer.stop()
  hoverCloseTimer.stop()
  if (next === open.value) return
  changedByHover = byHover
  open.value = next
  if (!next) {
    if (closeOpenMenu === close) closeOpenMenu = undefined
    return
  }
  if (closeOpenMenu !== close) closeOpenMenu?.()
  closeOpenMenu = close
  openedAt.value = new Date()
  emit('open')
}

function onOpenUpdate(next: boolean): void {
  if (!next && keepOpenOnClick) {
    keepOpenOnClick = false
    changedByHover = false
    return
  }
  setOpen(next)
}

function onTriggerPointerEnter(event: PointerEvent): void {
  if (event.pointerType === 'touch') return
  hoverCloseTimer.stop()
  if (!open.value) hoverOpenTimer.start()
}

function onMenuPointerEnter(event: PointerEvent): void {
  if (event.pointerType !== 'touch') hoverCloseTimer.stop()
}

function onPointerLeave(event: PointerEvent): void {
  if (event.pointerType === 'touch') return
  hoverOpenTimer.stop()
  keepOpenOnClick = false
  if (open.value) hoverCloseTimer.start()
}

function onTriggerPointerDown(): void {
  keepOpenOnClick = open.value && changedByHover
}

function onAutoFocus(event: Event): void {
  if (changedByHover) event.preventDefault()
}

onScopeDispose(() => {
  if (closeOpenMenu === close) closeOpenMenu = undefined
})

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
    class: 'cursor-pointer',
    command: () => tabActivity.openAgentChat(workflowPath, chat.id)
  })),
  { separator: true },
  {
    label: t('agent.newChatOnWorkflow'),
    icon: 'icon-[lucide--plus]',
    class: 'cursor-pointer',
    command: () => tabActivity.openAgentChat(workflowPath, null)
  }
])
</script>

<template>
  <Menu
    v-if="chats.length"
    :open
    :items
    :label="t('agent.workflowChatsMenuLabel', { workflowName })"
    :modal="false"
    side="bottom"
    align="start"
    :side-offset="4"
    @update:open="onOpenUpdate"
    @open-auto-focus="onAutoFocus"
    @close-auto-focus="onAutoFocus"
    @pointerenter="onMenuPointerEnter"
    @pointerleave="onPointerLeave"
  >
    <template #trigger>
      <Button
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="chatsLabel"
        :class="cn('shrink-0', className)"
        @pointerenter="onTriggerPointerEnter"
        @pointerleave="onPointerLeave"
        @pointerdown="onTriggerPointerDown"
        @click.stop="keepOpenOnClick = false"
      >
        <i class="icon-[lucide--message-square] size-3.5 shrink-0" />
      </Button>
    </template>
  </Menu>
</template>
