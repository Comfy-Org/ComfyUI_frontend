<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'
import {
  computed,
  nextTick,
  shallowRef,
  useId,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH
} from '@/workbench/extensions/agent/stores/agent/agentSidebarLayout'
import type {
  SidebarMode,
  SidebarSection
} from '@/workbench/extensions/agent/stores/agent/agentSidebarLayout'
import ChatList from '@/workbench/extensions/agent/components/agent/ChatList.vue'
import AgentSidebarNav from './AgentSidebarNav.vue'

const KEYBOARD_RESIZE_STEP = 16

const {
  mode,
  width = SIDEBAR_DEFAULT_WIDTH,
  section = 'chats',
  groups,
  loadingId = null,
  failedId = null,
  activeId = null,
  pinnedIds,
  workflowNames
} = defineProps<{
  mode: SidebarMode
  width?: number
  section?: SidebarSection
  groups: HistoryGroups
  loadingId?: string | null
  failedId?: string | null
  activeId?: string | null
  pinnedIds?: ReadonlySet<string>
  workflowNames?: ReadonlyMap<string, string>
}>()

const emit = defineEmits<{
  toggle: []
  dismissDrawer: []
  resize: [width: number]
  resetWidth: []
  newChat: []
  select: [id: string]
  delete: [id: string]
  rename: [id: string, title: string]
  copyMarkdown: [id: string]
  togglePin: [id: string]
  section: [section: SidebarSection]
  openTemplates: []
}>()

const { t } = useI18n()
const listId = useId()

const sectionLabel = computed(() => {
  if (section === 'apps') return t('agent.nav.apps')
  if (section === 'workflows') return t('agent.nav.workflows')
  return t('agent.sidebar.chats')
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || mode !== 'drawer') return
  event.stopPropagation()
  emit('dismissDrawer')
}

const resizeHandle = useTemplateRef<HTMLElement>('resizeHandle')
const rootElement = useTemplateRef<HTMLElement>('rootElement')

watch(
  () => mode,
  (next, previous) => {
    if (previous !== 'rail' || next === 'rail') return
    if (!rootElement.value?.contains(document.activeElement)) return
    void nextTick(() =>
      rootElement.value
        ?.querySelector<HTMLElement>('[aria-current="page"]')
        ?.focus()
    )
  }
)
const drag = shallowRef<{ startX: number; startWidth: number } | null>(null)

function onResizeStart(event: PointerEvent): void {
  if (event.button !== 0) return
  drag.value = { startX: event.clientX, startWidth: width }
  event.preventDefault()
  resizeHandle.value?.setPointerCapture(event.pointerId)
}

function stopResizing(): void {
  drag.value = null
}

useEventListener(document, 'pointermove', (event: PointerEvent) => {
  if (!drag.value) return
  emit('resize', drag.value.startWidth + event.clientX - drag.value.startX)
})
useEventListener(document, 'pointerup', stopResizing)
useEventListener(document, 'pointercancel', stopResizing)

function widthForKey(key: string): number | undefined {
  switch (key) {
    case 'ArrowRight':
      return width + KEYBOARD_RESIZE_STEP
    case 'ArrowLeft':
      return width - KEYBOARD_RESIZE_STEP
    case 'Home':
      return SIDEBAR_MIN_WIDTH
    case 'End':
      return SIDEBAR_MAX_WIDTH
    default:
      return undefined
  }
}

function onResizeKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('resetWidth')
    return
  }
  const nextWidth = widthForKey(event.key)
  if (nextWidth === undefined) return
  event.preventDefault()
  emit('resize', nextWidth)
}
</script>

<template>
  <div
    v-if="mode === 'drawer'"
    data-testid="agent-sidebar-scrim"
    class="absolute inset-0 z-10 bg-background/60"
    @click="emit('dismissDrawer')"
  />
  <div
    ref="rootElement"
    data-testid="agent-sidebar"
    :data-mode="mode"
    :class="
      cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-background',
        mode === 'rail' ? 'w-12' : 'w-65',
        mode === 'expanded' && 'relative',
        mode === 'drawer' && 'absolute inset-y-0 left-0 z-20 shadow-lg'
      )
    "
    :style="mode === 'expanded' ? { width: `${width}px` } : undefined"
    @keydown="onKeydown"
  >
    <div
      :class="
        cn(
          'flex h-12 shrink-0 items-center gap-1 border-b border-border px-2',
          mode === 'rail' ? 'justify-center' : 'pl-4'
        )
      "
    >
      <div v-if="mode !== 'rail'" class="flex min-w-0 flex-1 items-center">
        <slot name="brand" />
      </div>
      <Button
        :tooltip="
          mode === 'rail' ? t('agent.sidebar.open') : t('agent.sidebar.close')
        "
        tooltip-side="right"
        type="button"
        variant="muted-textonly"
        size="icon"
        :aria-label="
          mode === 'rail' ? t('agent.sidebar.open') : t('agent.sidebar.close')
        "
        :aria-expanded="mode !== 'rail'"
        :aria-controls="listId"
        @click="emit('toggle')"
      >
        <i aria-hidden="true" class="icon-[lucide--panel-left]" />
      </Button>
    </div>

    <div v-if="mode !== 'rail' && $slots.account" class="shrink-0 px-2 pt-2">
      <slot name="account" :compact="false" />
    </div>

    <AgentSidebarNav
      v-if="mode !== 'rail'"
      :section
      class="shrink-0 px-2 pt-2"
      @section="emit('section', $event)"
      @open-templates="emit('openTemplates')"
    />

    <div
      v-if="mode !== 'rail'"
      class="flex h-10 shrink-0 items-center gap-1 pr-2 pl-4"
    >
      <h2
        class="my-0 min-w-0 flex-1 truncate text-sm font-normal text-muted-foreground"
      >
        {{ sectionLabel }}
      </h2>
      <Button
        v-if="section === 'chats'"
        :tooltip="t('agent.newChat')"
        tooltip-side="bottom"
        type="button"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('agent.newChat')"
        @click="emit('newChat')"
      >
        <i aria-hidden="true" class="icon-[lucide--plus]" />
      </Button>
    </div>

    <div
      v-if="mode === 'rail'"
      class="flex flex-1 flex-col items-center gap-1 px-2 pt-2"
    >
      <slot name="account" :compact="true" />
      <Button
        :tooltip="t('agent.newChat')"
        tooltip-side="right"
        type="button"
        variant="muted-textonly"
        size="icon"
        :aria-label="t('agent.newChat')"
        @click="emit('newChat')"
      >
        <i aria-hidden="true" class="icon-[lucide--plus]" />
      </Button>
      <AgentSidebarNav
        :section
        compact
        @section="emit('section', $event)"
        @open-templates="emit('openTemplates')"
      />
    </div>
    <nav
      v-else-if="section === 'chats'"
      :id="listId"
      :aria-label="t('agent.sidebar.chats')"
      class="flex min-h-0 flex-1 flex-col"
    >
      <ChatList
        :groups
        :loading-id="loadingId"
        :failed-id="failedId"
        :active-id="activeId"
        :pinned-ids="pinnedIds"
        :workflow-names="workflowNames"
        full-row-select
        @toggle-pin="emit('togglePin', $event)"
        @select="emit('select', $event)"
        @delete="emit('delete', $event)"
        @copy-markdown="emit('copyMarkdown', $event)"
        @rename="(id, title) => emit('rename', id, title)"
      />
    </nav>
    <nav
      v-else
      :id="listId"
      :aria-label="sectionLabel"
      class="flex min-h-0 flex-1 flex-col"
    >
      <slot name="library" :section />
    </nav>

    <div v-if="$slots.footer" class="shrink-0 border-t border-border p-2">
      <slot name="footer" :compact="mode === 'rail'" />
    </div>

    <div
      v-if="mode === 'expanded'"
      ref="resizeHandle"
      role="separator"
      aria-orientation="vertical"
      :aria-label="t('agent.sidebar.resize')"
      :aria-valuenow="width"
      :aria-valuemin="SIDEBAR_MIN_WIDTH"
      :aria-valuemax="SIDEBAR_MAX_WIDTH"
      tabindex="0"
      data-testid="agent-sidebar-resize-handle"
      :data-resizing="drag !== null"
      class="absolute inset-y-0 left-full z-10 -ml-0.5 w-1.25 cursor-col-resize touch-none outline-none select-none hover:bg-primary hover:transition-colors hover:delay-300 hover:duration-200 focus-visible:bg-primary data-[resizing=true]:bg-primary"
      @pointerdown="onResizeStart"
      @lostpointercapture="stopResizing"
      @keydown="onResizeKeydown"
      @dblclick="emit('resetWidth')"
    />
  </div>
</template>
