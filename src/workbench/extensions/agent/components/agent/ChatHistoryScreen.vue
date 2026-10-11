<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'

import ChatHistorySelectButton from './ChatHistorySelectButton.vue'

import type {
  ChatSession,
  HistoryGroups
} from '../../stores/agent/agentChatHistoryStore'

const {
  groups,
  loadingId = null,
  failedId = null
} = defineProps<{
  groups: HistoryGroups
  loadingId?: string | null
  failedId?: string | null
}>()
const emit = defineEmits<{
  back: []
  select: [id: string]
  delete: [id: string]
  copyMarkdown: [id: string]
  rename: [id: string, title: string]
}>()

const { t } = useI18n()

const sections = computed(() =>
  (
    [
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
        <span class="icon-[lucide--chevron-left] size-4 shrink-0" />
      </Button>
      <h2 class="m-0 text-xs font-normal text-muted-foreground">
        {{ t('agent.history') }}
      </h2>
    </div>

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
          class="group flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-secondary-background-hover"
        >
          <div
            v-if="renamingId === session.id"
            class="flex min-w-0 flex-1 items-center"
          >
            <span
              class="icon-[lucide--circle-check] size-4 shrink-0 text-muted-foreground"
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
              <span class="icon-[lucide--copy] size-3.5" />
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
                  <span class="icon-[lucide--chevron-down] size-3" />
                </Button>
              </template>
            </Menu>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
