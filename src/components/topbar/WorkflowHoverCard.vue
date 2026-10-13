<script lang="ts">
// Hover can open one card while another one, opened from the keyboard, is
// still open, so opening a card closes whichever one is open.
let closeOpenCard: (() => void) | undefined
</script>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { unrefElement, useEventListener, useTimeoutFn } from '@vueuse/core'
import {
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, onScopeDispose, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import MenuContent from '@/components/ui/menu/MenuContent.vue'
import MenuItems from '@/components/ui/menu/MenuItems.vue'
import MenuSeparator from '@/components/ui/menu/MenuSeparator.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { formatRelativeTime } from '@/platform/workspace/utils/relativeTime'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkflowThumbnail } from '@/renderer/core/thumbnail/useWorkflowThumbnail'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

const HOVER_OPEN_DELAY_MS = 200
const HOVER_CLOSE_DELAY_MS = 150
const CHAT_ITEM_CLASS =
  'cursor-pointer focus-visible:bg-secondary-background-hover'

const {
  workflow,
  anchor = null,
  class: className
} = defineProps<{
  workflow: ComfyWorkflow
  /**
   * Opens the card on hover and places it; a click on it closes the card.
   * The chat indicator then only takes keyboard focus. Defaults to the
   * indicator.
   */
  anchor?: HTMLElement | null
  class?: HTMLAttributes['class']
}>()

const { t } = useI18n()
const tabActivity = useWorkflowTabActivityStore()
const workflowStore = useWorkflowStore()
const canvasStore = useCanvasStore()
const { getThumbnail, createMinimapPreview } = useWorkflowThumbnail()

const chats = computed(
  () => tabActivity.agentChatsByPath.get(workflow.path) ?? []
)
const offersChats = computed(
  () => tabActivity.agentChatsEnabled && workflow.isPersisted
)
const chatsLabel = computed(() =>
  t(
    'agent.workflowChatsCount',
    { workflowName: workflow.filename },
    chats.value.length
  )
)
const isActive = computed(() => workflowStore.isActive(workflow))
const livePreview = ref<string | null>(null)
const preview = computed(() =>
  isActive.value ? livePreview.value : getThumbnail(workflow.key)
)

const indicator = useTemplateRef('indicator')
const hoverTarget = computed(() => anchor ?? unrefElement(indicator))

const openedAt = ref(new Date())
const open = ref(false)
// Hover and clicks on the anchor open and close the card without moving focus.
let changedByPointer = false
// Clicking the indicator of a hover-opened card keeps it open instead of toggling.
let keepOpenOnClick = false
let openedFromKeyboard = false

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

function setOpen(next: boolean, byPointer = false): void {
  hoverOpenTimer.stop()
  hoverCloseTimer.stop()
  if (next === open.value) return
  changedByPointer = byPointer
  open.value = next
  if (!next) {
    if (closeOpenCard === close) closeOpenCard = undefined
    return
  }
  if (closeOpenCard !== close) closeOpenCard?.()
  closeOpenCard = close
  openedAt.value = new Date()
  void renderLivePreview()
}

async function renderLivePreview(): Promise<void> {
  livePreview.value = isActive.value
    ? await createMinimapPreview(canvasStore.currentGraph)
    : null
}

function onOpenUpdate(next: boolean): void {
  if (!next && keepOpenOnClick) {
    keepOpenOnClick = false
    changedByPointer = false
    return
  }
  setOpen(next)
}

function onHoverStart(event: PointerEvent): void {
  if (event.pointerType === 'touch') return
  hoverCloseTimer.stop()
  if (!open.value) hoverOpenTimer.start()
}

function onPointerLeave(event: PointerEvent): void {
  if (event.pointerType === 'touch') return
  hoverOpenTimer.stop()
  keepOpenOnClick = false
  if (open.value) hoverCloseTimer.start()
}

function onIndicatorPointerDown(): void {
  keepOpenOnClick = open.value && changedByPointer
  openedFromKeyboard = false
}

function onIndicatorKeydown(event: KeyboardEvent): void {
  openedFromKeyboard = ['Enter', ' ', 'ArrowDown'].includes(event.key)
}

useEventListener(hoverTarget, 'pointerenter', onHoverStart)
useEventListener(hoverTarget, 'pointerleave', onPointerLeave)
useEventListener(
  () => anchor,
  'pointerdown',
  () => setOpen(false, true)
)

function onOpenAutoFocus(event: Event): void {
  if (changedByPointer) {
    event.preventDefault()
    return
  }
  if (!openedFromKeyboard || !(event.target instanceof HTMLElement)) return
  openedFromKeyboard = false
  const firstItem = event.target.querySelector<HTMLElement>('[role="menuitem"]')
  if (!firstItem) return
  event.preventDefault()
  firstItem.focus()
}

function onCloseAutoFocus(event: Event): void {
  if (changedByPointer) event.preventDefault()
}

onScopeDispose(() => {
  if (closeOpenCard === close) closeOpenCard = undefined
})

function lastActive(updatedAt: number): string {
  return formatRelativeTime(new Date(updatedAt), openedAt.value, {
    justNow: t('g.relativeTime.now'),
    minutesAgo: (count) => t('g.relativeTime.minutesAgo', { count }),
    hoursAgo: (count) => t('g.relativeTime.hoursAgo', { count }),
    daysAgo: (count) => t('g.relativeTime.daysAgo', { count })
  })
}

const chatItems = computed<MenuItem[]>(() => {
  const newChat: MenuItem = {
    label: t('agent.newChatOnWorkflow'),
    icon: 'icon-[lucide--plus]',
    class: CHAT_ITEM_CLASS,
    command: () => tabActivity.openAgentChat(workflow.path, null)
  }
  if (!chats.value.length) return [newChat]
  return [
    ...chats.value.map((chat) => ({
      label: chat.title,
      description: chat.current
        ? t('agent.currentWorkflowChat', {
            lastActive: lastActive(chat.updatedAt)
          })
        : lastActive(chat.updatedAt),
      icon: 'icon-[lucide--message-square]',
      class: CHAT_ITEM_CLASS,
      command: () => tabActivity.openAgentChat(workflow.path, chat.id)
    })),
    { separator: true },
    newChat
  ]
})
</script>

<template>
  <DropdownMenuRoot :open :modal="false" @update:open="onOpenUpdate">
    <DropdownMenuTrigger v-if="chats.length" as-child>
      <Button
        ref="indicator"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="chatsLabel"
        :class="
          cn(
            'shrink-0 text-smoke-800',
            anchor && 'pointer-events-none',
            className
          )
        "
        @pointerdown="onIndicatorPointerDown"
        @keydown="onIndicatorKeydown"
        @click.stop="keepOpenOnClick = false"
      >
        <i class="icon-[lucide--message-square] size-2.5 shrink-0" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <MenuContent
        data-testid="workflow-hover-card"
        :reference="anchor ?? undefined"
        side="bottom"
        :align="anchor ? 'center' : 'start'"
        :side-offset="anchor ? 8 : 4"
        :collision-padding="8"
        class="max-w-64"
        @open-auto-focus="onOpenAutoFocus"
        @close-auto-focus="onCloseAutoFocus"
        @pointerenter="onHoverStart"
        @pointerleave="onPointerLeave"
      >
        <img
          v-if="preview"
          :src="preview"
          :alt="
            t('sideToolbar.workflowTab.workflowPreview', {
              workflowName: workflow.filename
            })
          "
          class="block h-50 w-62 rounded-md bg-secondary-background object-contain p-2"
        />
        <p class="truncate px-3 py-1.5 text-sm font-medium">
          {{ workflow.filename }}
        </p>
        <template v-if="offersChats">
          <MenuSeparator />
          <MenuItems :items="chatItems" @select="close" />
        </template>
      </MenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
