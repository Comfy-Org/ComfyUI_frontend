<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ComposerAttachment } from '../../composables/agent/useComposer'
import type {
  ApprovalCard,
  ConflictChoice,
  LockState
} from './safety/safetyTypes'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'
import type { HistoryGroups } from '../../stores/agent/agentChatHistoryStore'

import ChatHistoryScreen from './ChatHistoryScreen.vue'
import Composer from './Composer.vue'
import ConversationView from './ConversationView.vue'
import EmptyState from './EmptyState.vue'
import PanelHeader from './PanelHeader.vue'
import SessionBar from './SessionBar.vue'
import ApprovalCardView from './safety/ApprovalCard.vue'
import ConflictDialog from './safety/ConflictDialog.vue'
import LockBanner from './safety/LockBanner.vue'
import RevertButton from './safety/RevertButton.vue'

const {
  entries,
  userName,
  streaming = false,
  submitting = false,
  approvalCards = [],
  lockState = 'UNLOCKED',
  conflictOpen = false,
  canRevert = false,
  canAttach = false,
  isMaximized = false,
  historyGroups
} = defineProps<{
  entries: ConversationEntry[]
  userName?: string
  streaming?: boolean
  submitting?: boolean
  approvalCards?: ApprovalCard[]
  lockState?: LockState
  conflictOpen?: boolean
  canRevert?: boolean
  canAttach?: boolean
  isMaximized?: boolean
  historyGroups: HistoryGroups
}>()
const emit = defineEmits<{
  send: [text: string, attachments: ComposerAttachment[]]
  stop: []
  attach: []
  feedback: [turnId: string, vote: 'up' | 'down' | null]
  answer: [approvalId: string, approved: boolean]
  takeControl: []
  resolveConflict: [choice: ConflictChoice]
  revert: []
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
// "New Chat" (SessionBar's fallback).
const sessionTitle = computed(() => {
  const firstUser = entries.find(
    (entry): entry is Extract<ConversationEntry, { role: 'user' }> =>
      entry.role === 'user'
  )
  return firstUser?.text.trim().slice(0, 60) || undefined
})

// The root wires the file picker + upload and stages the result back through here, so the
// panel forwards a staged attachment down to the composer without owning the upload path.
function addAttachment(attachment: ComposerAttachment): void {
  composerRef.value?.addAttachment(attachment)
}

defineExpose({ addAttachment })
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

      <LockBanner :state="lockState" @take-control="emit('takeControl')" />

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
      <div v-if="approvalCards.length || canRevert" class="space-y-2 px-3 pb-1">
        <ApprovalCardView
          v-for="card in approvalCards"
          :key="card.approvalId"
          :card="card"
          @answer="(id, approved) => emit('answer', id, approved)"
        />
        <div v-if="canRevert" class="flex justify-end">
          <RevertButton :can-revert="canRevert" @revert="emit('revert')" />
        </div>
      </div>

      <footer class="shrink-0 p-4">
        <div class="mx-auto flex w-full max-w-[640px] flex-col gap-2.5">
          <Composer
            ref="composerRef"
            :streaming="streaming"
            :submitting="submitting"
            :can-attach="canAttach"
            @send="(text, attachments) => emit('send', text, attachments)"
            @stop="emit('stop')"
            @attach="emit('attach')"
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
