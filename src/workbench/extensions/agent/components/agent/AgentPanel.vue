<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ActiveTab } from './ActiveTabStrip.vue'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import type { ConflictChoice } from './safety/ConflictDialog.vue'
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
import ConflictDialog from './safety/ConflictDialog.vue'

const {
  entries,
  userName,
  streaming = false,
  submitting = false,
  conflictOpen = false,
  canAttach = false,
  isMaximized = false,
  selectionTags = [],
  activeTab = null,
  workflowTabs = [],
  getMentionNodes = () => [],
  historyGroups
} = defineProps<{
  entries: ConversationEntry[]
  userName?: string
  streaming?: boolean
  submitting?: boolean
  conflictOpen?: boolean
  canAttach?: boolean
  isMaximized?: boolean
  selectionTags?: SelectedNode[]
  activeTab?: ActiveTab | null
  workflowTabs?: ActiveTab[]
  getMentionNodes?: () => SelectedNode[]
  historyGroups: HistoryGroups
}>()
const emit = defineEmits<{
  send: [text: string, attachments: ComposerAttachment[]]
  stop: []
  attach: []
  removeTag: [id: string]
  mentionPick: [node: SelectedNode]
  feedback: [turnId: string, vote: 'up' | 'down' | null]
  resolveConflict: [choice: ConflictChoice]
  selectTab: [path: string]
  newChat: []
  toggleSize: []
  close: []
  openHistory: []
  selectHistory: [id: string]
  deleteHistory: [id: string]
  copyHistory: [id: string]
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
  const firstUser = entries.find(
    (entry): entry is Extract<ConversationEntry, { role: 'user' }> =>
      entry.role === 'user'
  )
  return firstUser?.text.trim().slice(0, 60) || undefined
})

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
        <button
          v-tooltip.bottom="{
            value: t('agent.showChatHistory'),
            showDelay: 500
          }"
          type="button"
          class="text-agent-fg-muted hover:bg-agent-surface-hover flex h-6 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs transition-colors"
          @click="onOpenHistory"
        >
          <span class="icon-[lucide--align-justify] size-3.5 shrink-0" />
          <span class="max-w-56 truncate">{{
            sessionTitle || t('agent.newChatTitle')
          }}</span>
        </button>
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
            @select-tab="emit('selectTab', $event)"
          />
          <RunNoticeBanner />
          <Composer
            ref="composerRef"
            :streaming="streaming"
            :submitting="submitting"
            :can-attach="canAttach"
            :selection-tags="selectionTags"
            :get-mention-nodes="getMentionNodes"
            @send="(text, attachments) => emit('send', text, attachments)"
            @stop="emit('stop')"
            @attach="emit('attach')"
            @remove-tag="emit('removeTag', $event)"
            @mention-pick="emit('mentionPick', $event)"
          />
          <p class="text-agent-fg-muted my-0 text-center text-xs">
            {{ t('agent.caption') }}
          </p>
        </div>
      </footer>
    </template>

    <ConflictDialog
      :open="conflictOpen"
      @resolve="emit('resolveConflict', $event)"
    />
  </section>
</template>
