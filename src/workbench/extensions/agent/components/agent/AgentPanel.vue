<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ActiveTab } from './ActiveTabStrip.vue'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import type { ConflictChoice } from './safety/safetyTypes'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'
import type { HistoryGroups } from '../../stores/agent/agentChatHistoryStore'

import ChatHistoryScreen from './ChatHistoryScreen.vue'
import Composer from './Composer.vue'
import ConversationView from './ConversationView.vue'
import EmptyState from './EmptyState.vue'
import PanelHeader from './PanelHeader.vue'
import SessionBar from './SessionBar.vue'
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
  newChat: []
  toggleSize: []
  close: []
  openHistory: []
  selectHistory: [id: string]
  deleteHistory: [id: string]
  copyHistory: [id: string]
}>()

// In-panel Chat History screen (B12): the session bar opens it, the back arrow / picking a
// chat / starting a new chat closes it. Rendered inline instead of a teleported drawer.
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

// Session bar title (B4): the first user prompt titles the session; a fresh session reads
// "Untitled" (SessionBar's fallback), per the DES-455 chat-history flow.
const sessionTitle = computed(() => {
  const firstUser = entries.find(
    (entry): entry is Extract<ConversationEntry, { role: 'user' }> =>
      entry.role === 'user'
  )
  return firstUser?.text.trim().slice(0, 60) || undefined
})

// The root wires the file picker + upload lifecycle and drives the composer's
// staged chips through these, without the panel owning the upload path.
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
      :active-tab="activeTab"
      @new-chat="onNewChat"
      @toggle-size="emit('toggleSize')"
      @close="emit('close')"
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
      <SessionBar :title="sessionTitle" @open-history="onOpenHistory" />

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
