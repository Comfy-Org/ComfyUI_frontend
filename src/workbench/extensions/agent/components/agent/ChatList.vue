<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Input from '@comfyorg/design-system/input/Input'
import Menu from '@comfyorg/design-system/menu/Menu'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import { cn } from '@comfyorg/tailwind-utils'

import ChatHistorySelectButton from './ChatHistorySelectButton.vue'

import type {
  ChatSession,
  HistoryGroups
} from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

const {
  groups,
  loadingId = null,
  failedId = null,
  activeId = null,
  pinnedIds,
  workflowNames,
  fullRowSelect = false
} = defineProps<{
  groups: HistoryGroups
  loadingId?: string | null
  failedId?: string | null
  activeId?: string | null
  pinnedIds?: ReadonlySet<string>
  workflowNames?: ReadonlyMap<string, string>
  fullRowSelect?: boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  delete: [id: string]
  copyMarkdown: [id: string]
  rename: [id: string, title: string]
  togglePin: [id: string]
}>()

const { t } = useI18n()

const sections = computed(() =>
  (
    [
      ['pinned', t('agent.sidebar.pinned'), groups.pinned ?? []],
      ['current', t('agent.historyCurrent'), groups.current],
      ['today', t('agent.historyToday'), groups.today],
      ['yesterday', t('agent.historyYesterday'), groups.yesterday],
      ['earlier', t('agent.historyEarlier'), groups.earlier]
    ] as const
  ).filter(([, , items]) => items.length > 0)
)

const isEmpty = computed(() => sections.value.length === 0)

function pick(session: ChatSession): void {
  emit('select', session.id)
}

function workflowLabel(session: ChatSession): string | undefined {
  if (!workflowNames) return undefined
  return session.workflowId === undefined
    ? t('agent.sidebar.noWorkflow')
    : workflowNames.get(session.workflowId)
}

const MAX_TITLE_LENGTH = 200

const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const selectOnFocus = ref(false)

function startRename(session: ChatSession): void {
  renamingId.value = session.id
  renameDraft.value = session.title
  selectOnFocus.value = true
}

function focusInput(el: Element | ComponentPublicInstance | null): void {
  const input: unknown = el instanceof Element ? el : el?.$el
  if (!(input instanceof HTMLInputElement)) return
  const shouldSelect = selectOnFocus.value
  selectOnFocus.value = false
  void nextTick(() => {
    if (!input.isConnected) return
    input.focus()
    if (shouldSelect) input.select()
  })
}

function cancelRename(): void {
  renamingId.value = null
}

function commitRename(session: ChatSession): void {
  if (renamingId.value !== session.id) return
  renamingId.value = null
  const title = renameDraft.value.trim()
  if (title !== '' && title !== session.title.trim())
    emit('rename', session.id, title)
}

function onMenuCloseAutoFocus(event: Event): void {
  if (renamingId.value !== null) event.preventDefault()
}

function onRenameKeydown(session: ChatSession, event: KeyboardEvent): void {
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    commitRename(session)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
  }
}

function pinItems(session: ChatSession): MenuItem[] {
  if (!pinnedIds) return []
  const pinned = pinnedIds.has(session.id)
  return [
    {
      label: pinned ? t('agent.sidebar.unpin') : t('agent.sidebar.pin'),
      icon: pinned ? 'icon-[lucide--pin-off]' : 'icon-[lucide--pin]',
      command: () => emit('togglePin', session.id)
    }
  ]
}

function getSessionMenuItems(session: ChatSession): MenuItem[] {
  return [
    ...pinItems(session),
    {
      label: t('g.rename'),
      icon: 'icon-[lucide--pencil]',
      command: () => startRename(session)
    },
    { separator: true },
    {
      label: t('g.delete'),
      icon: 'icon-[lucide--trash-2]',
      variant: 'destructive',
      command: () => emit('delete', session.id)
    }
  ]
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    <p
      v-if="isEmpty"
      class="px-2 py-8 text-center text-sm text-muted-foreground"
    >
      {{ t('agent.historyEmpty') }}
    </p>

    <section v-for="[key, label, items] in sections" :key class="mb-3">
      <p class="my-0 px-2 py-1 text-xs text-muted-foreground">
        {{ label }}
      </p>
      <div
        v-for="session in items"
        :key="session.id"
        data-testid="chat-row"
        :aria-current="session.id === activeId ? 'true' : undefined"
        :class="
          cn(
            'group flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent',
            fullRowSelect && 'relative isolate',
            session.id === activeId && 'bg-secondary'
          )
        "
      >
        <div
          v-if="renamingId === session.id"
          class="flex min-w-0 flex-1 items-center"
        >
          <i
            aria-hidden="true"
            class="icon-[lucide--circle-check] text-muted-foreground"
          />
          <Input
            :ref="focusInput"
            v-model="renameDraft"
            type="text"
            :aria-label="t('g.rename')"
            :maxlength="MAX_TITLE_LENGTH"
            class="h-6 flex-1 px-2 py-1 text-xs"
            @keydown="onRenameKeydown(session, $event)"
            @blur="commitRename(session)"
          />
        </div>
        <template v-else>
          <ChatHistorySelectButton
            :title="session.title"
            :subtitle="workflowLabel(session)"
            :loading="loadingId === session.id"
            :failed="failedId === session.id"
            :full-row="fullRowSelect"
            @select="pick(session)"
          />
          <Button
            :tooltip="t('agent.copyMarkdown')"
            type="button"
            variant="muted-textonly"
            size="icon-sm"
            :class="cn('shrink-0', fullRowSelect && 'z-10')"
            :aria-label="t('agent.copyMarkdown')"
            :disabled="loadingId === session.id"
            @click="emit('copyMarkdown', session.id)"
          >
            <i aria-hidden="true" class="icon-[lucide--copy] size-3.5" />
          </Button>
          <Menu
            :items="getSessionMenuItems(session)"
            side="bottom"
            align="end"
            :side-offset="4"
            class="agent-scope"
            @close-auto-focus="onMenuCloseAutoFocus"
          >
            <template #trigger>
              <Button
                variant="muted-textonly"
                size="icon-sm"
                :class="cn('size-6 shrink-0', fullRowSelect && 'z-10')"
                :aria-label="t('agent.chatOptions')"
                :disabled="loadingId === session.id"
              >
                <i
                  aria-hidden="true"
                  class="icon-[lucide--chevron-down] size-3"
                />
              </Button>
            </template>
          </Menu>
        </template>
      </div>
    </section>
  </div>
</template>
