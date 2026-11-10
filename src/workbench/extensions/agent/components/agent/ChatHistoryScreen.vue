<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Input from '@comfyorg/design-system/input/Input'
import Menu from '@comfyorg/design-system/menu/Menu'
import SearchInput from '@comfyorg/design-system/search-input/SearchInput'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'

import ChatHistorySelectButton from './ChatHistorySelectButton.vue'

import { useChatHistorySearch } from '@/workbench/extensions/agent/composables/agent/useChatHistorySearch'
import type { ChatHistorySearchResult } from '@/workbench/extensions/agent/composables/agent/useChatHistorySearch'
import type {
  ChatSession,
  HistoryGroups
} from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { formatShortMonthDay } from '@/utils/dateTimeUtil'

const {
  groups,
  workflowNameFor = () => undefined,
  loadingId = null,
  failedId = null,
  narrow = false
} = defineProps<{
  groups: HistoryGroups
  /** Resolved workflow title for a session; undefined while unresolved. */
  workflowNameFor?: (session: { workflowId?: string }) => string | undefined
  loadingId?: string | null
  failedId?: string | null
  /** Dock narrower than ~350 px; result rows drop the workflow tail. */
  narrow?: boolean
}>()
const emit = defineEmits<{
  back: []
  select: [id: string]
  delete: [id: string]
  copyMarkdown: [id: string]
  rename: [id: string, title: string]
}>()

const { t, locale } = useI18n()

// `groups` already carries the live current-chat title, so the search reads
// the same displayed data; only recency order is rebuilt from the buckets.
const search = useChatHistorySearch({
  sessions: () =>
    [
      ...groups.current,
      ...groups.today,
      ...groups.yesterday,
      ...groups.earlier
    ].sort((a, b) => b.updatedAt - a.updatedAt),
  currentSessionId: () => groups.current[0]?.id ?? null,
  currentSessionTitle: () => undefined,
  workflowNameFor: (session) => workflowNameFor(session)
})

interface HistorySection {
  key: string
  label?: string
  items: {
    session: ChatSession
    result?: { preview?: string; workflowName?: string; isCurrent: boolean }
    ranges?: ChatHistorySearchResult['ranges']
  }[]
}

const sections = computed<HistorySection[]>(() => {
  const results = search.results.value
  if (results) {
    return results.length === 0
      ? []
      : [
          {
            key: 'results',
            items: results.map(({ session, ranges }) => ({
              session,
              result: session,
              ranges
            }))
          }
        ]
  }
  return (
    [
      ['current', t('agent.historyCurrent'), groups.current],
      ['today', t('agent.historyToday'), groups.today],
      ['yesterday', t('agent.historyYesterday'), groups.yesterday],
      ['earlier', t('agent.historyEarlier'), groups.earlier]
    ] as const
  )
    .filter(([, , items]) => items.length > 0)
    .map(([key, label, items]) => ({
      key,
      label,
      items: items.map((session) => ({ session }))
    }))
})

const isEmpty = computed(
  () => !search.isNoResults.value && sections.value.length === 0
)

const searchField =
  useTemplateRef<InstanceType<typeof SearchInput>>('searchField')
const resultsList = useTemplateRef<HTMLElement[]>('resultsList')

function focusField(): void {
  searchField.value?.focus()
}

// Arrow navigation covers search results only; the grouped list keeps Tab.
function resultButtons(): HTMLButtonElement[] {
  if (!search.results.value) return []
  return (resultsList.value ?? []).flatMap((list) =>
    Array.from(
      list.querySelectorAll<HTMLButtonElement>('button[data-history-result]')
    ).filter((button) => !button.disabled)
  )
}

// Esc is consumed here so it never reaches an ancestor or global Esc path.
function escapeSearch(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
  if (search.onEscape() === 'leaveHistory') emit('back')
  else focusField()
}

function onFieldKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return
  if (event.key === 'Escape') escapeSearch(event)
  else if (event.key === 'ArrowDown') {
    const [first] = resultButtons()
    if (!first) return
    event.preventDefault()
    // Capture phase + stop: the combobox input's own ArrowDown handling
    // would otherwise pull focus back to the input.
    event.stopPropagation()
    first.focus()
  }
}

// Roving focus: arrows move between the result select buttons. Other tab
// stops in a row (copy, menu) keep their native behaviour.
function onResultsKeydown(event: KeyboardEvent): void {
  const target = event.target
  if (
    event.isComposing ||
    !(target instanceof HTMLButtonElement) ||
    !target.hasAttribute('data-history-result') ||
    !search.results.value
  )
    return
  if (event.key === 'Escape') return escapeSearch(event)
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const buttons = resultButtons()
    const next = buttons.indexOf(target) + (event.key === 'ArrowDown' ? 1 : -1)
    if (next < 0) focusField()
    else buttons[Math.min(next, buttons.length - 1)]?.focus()
    return
  }
  // A printable key hands focus back so the character lands in the field.
  if (
    event.key.length === 1 &&
    event.key !== ' ' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  )
    focusField()
}

function pick(session: ChatSession): void {
  emit('select', session.id)
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

// Runs on every mount of the editor, so a row that regroups mid-rename gets
// focus back; selecting is confined to the fresh open so a remount cannot
// wipe what the user has already typed.
function focusInput(el: Element | ComponentPublicInstance | null): void {
  const input: unknown = el instanceof Element ? el : el?.$el
  if (!(input instanceof HTMLInputElement)) return
  const shouldSelect = selectOnFocus.value
  selectOnFocus.value = false
  // Deferred because the ref fires before the element is in the document and
  // before v-model has written the draft, so focusing here directly would
  // leave the caret at the end instead of selecting the existing title.
  void nextTick(() => {
    // The row can unmount within the tick (rapid regroup, delete); focusing a
    // detached element is a silent no-op in browsers, but bail explicitly
    // instead of relying on that quirk.
    if (!input.isConnected) return
    input.focus()
    if (shouldSelect) input.select()
  })
}

function cancelRename(): void {
  renamingId.value = null
}

function commitRename(session: ChatSession): void {
  // Idempotence guard: commit is reachable from both Enter and blur, so a
  // second call for an already-ended rename must not emit a duplicate.
  if (renamingId.value !== session.id) return
  renamingId.value = null
  const title = renameDraft.value.trim()
  if (title !== '' && title !== session.title.trim())
    emit('rename', session.id, title)
}

// Fence reka-ui's close focus-restore only when a rename was just started
// (@select fires before this event, so renamingId is already set on that
// path); otherwise let Escape/outside-click return focus to the trigger so
// keyboard users keep their place.
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

function getSessionMenuItems(session: ChatSession): MenuItem[] {
  return [
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
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex h-10 shrink-0 items-center gap-1 px-2">
      <Button
        :tooltip="t('agent.backToPreviousChat')"
        tooltip-side="bottom"
        type="button"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('agent.backToPreviousChat')"
        class="size-6 shrink-0"
        @click="emit('back')"
      >
        <i aria-hidden="true" class="icon-[lucide--chevron-left]" />
      </Button>
      <h2 class="m-0 text-xs font-normal text-muted-foreground">
        {{ t('agent.history') }}
      </h2>
    </div>

    <div class="shrink-0 px-2 pb-1">
      <SearchInput
        ref="searchField"
        v-model="search.text.value"
        :placeholder="t('agent.historySearchPlaceholder')"
        :accessible-label="t('agent.historySearchLabel')"
        :clear-label="t('agent.historySearchClear')"
        size="sm"
        @keydown.capture="onFieldKeydown"
      />
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <p
        v-if="search.isNoResults.value"
        class="px-2 py-8 text-center text-sm text-muted-foreground"
      >
        {{ t('agent.historyNoResults', { query: search.text.value.trim() }) }}
      </p>
      <p
        v-else-if="isEmpty"
        class="px-2 py-8 text-center text-sm text-muted-foreground"
      >
        {{ t('agent.historyEmpty') }}
      </p>

      <section
        v-for="{ key, label, items } in sections"
        :key
        ref="resultsList"
        class="mb-3"
        :role="key === 'results' ? 'list' : undefined"
        :aria-label="
          key === 'results' ? t('agent.historyResultsLabel') : undefined
        "
        @keydown="onResultsKeydown"
      >
        <p v-if="label" class="my-0 px-2 py-1 text-xs text-muted-foreground">
          {{ label }}
        </p>
        <div
          v-for="{ session, result, ranges } in items"
          :key="session.id"
          :role="key === 'results' ? 'listitem' : undefined"
          class="group flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent"
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
              :preview="result?.preview"
              :date="
                result
                  ? formatShortMonthDay(session.updatedAt, locale)
                  : undefined
              "
              :workflow-name="result?.workflowName"
              :ranges
              :narrow
              :current="result?.isCurrent"
              :loading="loadingId === session.id"
              :failed="failedId === session.id"
              @select="pick(session)"
            />
            <Button
              :tooltip="t('agent.copyMarkdown')"
              type="button"
              variant="muted-textonly"
              size="icon-sm"
              class="shrink-0"
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
                  class="size-6 shrink-0"
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
  </div>
</template>
