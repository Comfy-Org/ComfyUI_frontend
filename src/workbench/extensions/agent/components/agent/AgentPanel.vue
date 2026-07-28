<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildTooltipConfig } from '@/composables/useTooltipConfig'

import type { ActiveTab } from './ActiveTabStrip.vue'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'
import type { HistoryGroups } from '../../stores/agent/agentChatHistoryStore'

import ActiveTabStrip from './ActiveTabStrip.vue'
import ChatHistoryScreen from './ChatHistoryScreen.vue'
import Composer from './Composer.vue'
import ConversationView from './ConversationView.vue'
import EmptyState from './EmptyState.vue'
import PanelHeader from './PanelHeader.vue'
import RunNoticeBanner from './RunNoticeBanner.vue'
import WorkflowSelectorChip from './composer/WorkflowSelectorChip.vue'

const {
  entries,
  userName,
  streaming = false,
  submitting = false,
  canAttach = false,
  canOpenAssets = false,
  isMaximized = false,
  selectionTags = [],
  activeTab = null,
  workflowTabs = [],
  workflowDetached = false,
  getMentionNodes = () => [],
  sessionId = null,
  customTitle,
  historyGroups
} = defineProps<{
  entries: ConversationEntry[]
  userName?: string
  streaming?: boolean
  submitting?: boolean
  canAttach?: boolean
  canOpenAssets?: boolean
  isMaximized?: boolean
  selectionTags?: SelectedNode[]
  activeTab?: ActiveTab | null
  workflowTabs?: ActiveTab[]
  workflowDetached?: boolean
  getMentionNodes?: () => SelectedNode[]
  sessionId?: string | null
  customTitle?: string
  historyGroups: HistoryGroups
}>()
const emit = defineEmits<{
  send: [text: string, attachments: ComposerAttachment[]]
  stop: []
  attach: []
  openAssets: []
  removeTag: [id: string]
  mentionPick: [node: SelectedNode]
  feedback: [turnId: string, vote: 'up' | 'down' | null]
  selectTab: [path: string]
  clearWorkflow: []
  newChat: []
  toggleSize: []
  close: []
  openHistory: []
  selectHistory: [id: string]
  deleteHistory: [id: string]
  copyHistory: [id: string]
  renameChat: [title: string]
}>()

const showHistory = ref(false)

function onNewChat(): void {
  showHistory.value = false
  emit('newChat')
}
function onOpenHistory(): void {
  showHistory.value = true
  emit('openHistory')
}
function onSelectHistory(id: string): void {
  showHistory.value = false
  emit('selectHistory', id)
}

const composerRef = ref<InstanceType<typeof Composer>>()

const { t } = useI18n()

const sessionTitle = computed(() => {
  if (customTitle) return customTitle
  const firstUser = entries.find(
    (entry): entry is Extract<ConversationEntry, { role: 'user' }> =>
      entry.role === 'user'
  )
  return firstUser?.text.trim().slice(0, 60) || undefined
})

const renaming = ref(false)
const renameDraft = ref('')
const renameInput = ref<HTMLInputElement>()
const titleButton = ref<HTMLButtonElement>()

async function startRename(): Promise<void> {
  renameDraft.value = sessionTitle.value ?? ''
  renaming.value = true
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

async function exitRename(): Promise<void> {
  renaming.value = false
  await nextTick()
  titleButton.value?.focus()
}

function onRenameKeydown(event: KeyboardEvent): void {
  // A CJK composition confirms and cancels with these same keys.
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    commitRename()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    void exitRename()
  }
}

function commitRename(): void {
  if (!renaming.value) return
  void exitRename()
  const title = renameDraft.value.trim()
  if (title !== '' && title !== sessionTitle.value) emit('renameChat', title)
}

function onDeleteChat(): void {
  if (sessionId !== null) emit('deleteHistory', sessionId)
}

function addAttachment(attachment: ComposerAttachment): void {
  composerRef.value?.addAttachment(attachment)
}

function updateAttachment(
  id: string,
  patch: Partial<ComposerAttachment>
): void {
  composerRef.value?.updateAttachment(id, patch)
}

function removeAttachment(id: string): void {
  composerRef.value?.removeAttachment(id)
}

defineExpose({ addAttachment, updateAttachment, removeAttachment })
</script>

<template>
  <section
    class="bg-agent-surface text-agent-fg @container flex h-full flex-col overflow-hidden"
  >
    <PanelHeader
      :is-maximized="isMaximized"
      @new-chat="onNewChat"
      @toggle-size="emit('toggleSize')"
      @close="emit('close')"
    />

    <ActiveTabStrip
      :tab="activeTab"
      class="border-agent-border shrink-0 border-b px-2 py-1.5"
    />

    <template v-if="showHistory">
      <ChatHistoryScreen
        :groups="historyGroups"
        class="min-h-0 flex-1"
        @back="showHistory = false"
        @select="onSelectHistory"
        @delete="emit('deleteHistory', $event)"
        @copy-markdown="emit('copyHistory', $event)"
      />
    </template>

    <template v-else>
      <div class="flex shrink-0 items-center px-2 py-1.5">
        <input
          v-if="renaming"
          ref="renameInput"
          v-model="renameDraft"
          type="text"
          :aria-label="t('g.rename')"
          class="text-agent-fg border-agent-border focus:border-agent-fg-muted h-6 max-w-64 rounded-sm border px-2 text-xs outline-none"
          @keydown="onRenameKeydown"
          @blur="commitRename"
        />
        <template v-else>
          <button
            ref="titleButton"
            v-tooltip.bottom="buildTooltipConfig(t('agent.showChatHistory'))"
            type="button"
            class="text-agent-fg-muted hover:bg-agent-surface-hover flex h-6 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs transition-colors"
            @click="onOpenHistory"
          >
            <span class="icon-[lucide--align-justify] size-3.5 shrink-0" />
            <span class="max-w-56 truncate">{{
              sessionTitle || t('agent.newChatTitle')
            }}</span>
          </button>
          <DropdownMenuRoot v-if="sessionId">
            <DropdownMenuTrigger
              v-tooltip.bottom="buildTooltipConfig(t('agent.chatOptions'))"
              :aria-label="t('agent.chatOptions')"
              class="text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 cursor-pointer items-center justify-center rounded-sm transition-colors"
            >
              <span class="icon-[lucide--chevron-down] size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                side="bottom"
                align="start"
                :side-offset="4"
                class="agent-scope rounded-agent border-agent-border bg-agent-surface-raised z-1100 w-40 border p-1 shadow-lg"
              >
                <DropdownMenuItem
                  class="text-agent-fg data-highlighted:bg-agent-surface-hover rounded-agent flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs outline-none"
                  @select="startRename"
                >
                  <span class="icon-[lucide--pencil] size-3.5 shrink-0" />
                  <span class="truncate">{{ t('g.rename') }}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="text-agent-fg data-highlighted:bg-agent-surface-hover data-highlighted:text-agent-danger rounded-agent flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs outline-none"
                  @select="onDeleteChat"
                >
                  <span class="icon-[lucide--trash-2] size-3.5 shrink-0" />
                  <span class="truncate">{{ t('g.delete') }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </template>
      </div>

      <div class="min-h-0 flex-1">
        <EmptyState
          v-if="!entries.length"
          :user-name="userName"
          @insert="composerRef?.insert($event)"
        />
        <ConversationView
          v-else
          :entries="entries"
          @feedback="(id, vote) => emit('feedback', id, vote)"
        />
      </div>
    </template>

    <template v-if="!showHistory">
      <footer class="shrink-0 p-4">
        <div class="mx-auto flex w-full max-w-[640px] flex-col gap-2.5">
          <WorkflowSelectorChip
            :active-tab="activeTab"
            :tabs="workflowTabs"
            :detached="workflowDetached"
            @select-tab="emit('selectTab', $event)"
            @clear="emit('clearWorkflow')"
          />
          <RunNoticeBanner />
          <Composer
            ref="composerRef"
            :streaming="streaming"
            :submitting="submitting"
            :can-attach="canAttach"
            :can-open-assets="canOpenAssets"
            :selection-tags="selectionTags"
            :get-mention-nodes="getMentionNodes"
            @send="(text, attachments) => emit('send', text, attachments)"
            @stop="emit('stop')"
            @attach="emit('attach')"
            @open-assets="emit('openAssets')"
            @remove-tag="emit('removeTag', $event)"
            @mention-pick="emit('mentionPick', $event)"
          />
          <p class="text-agent-fg-muted my-0 text-center text-xs">
            {{ t('agent.caption') }}
          </p>
        </div>
      </footer>
    </template>
  </section>
</template>
