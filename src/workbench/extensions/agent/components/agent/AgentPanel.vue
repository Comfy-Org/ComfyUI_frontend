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
  approvalCards = [],
  lockState = 'UNLOCKED',
  conflictOpen = false,
  canRevert = false,
  canAttach = false,
  isMaximized = false
} = defineProps<{
  entries: ConversationEntry[]
  userName?: string
  streaming?: boolean
  approvalCards?: ApprovalCard[]
  lockState?: LockState
  conflictOpen?: boolean
  canRevert?: boolean
  canAttach?: boolean
  isMaximized?: boolean
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
}>()

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
      @new-chat="emit('newChat')"
      @toggle-size="emit('toggleSize')"
      @close="emit('close')"
    />

    <SessionBar :title="sessionTitle" @open-history="emit('openHistory')" />

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
        :user-name="userName"
        @feedback="(id, vote) => emit('feedback', id, vote)"
      />
    </div>

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

    <ConflictDialog
      :open="conflictOpen"
      @resolve="emit('resolveConflict', $event)"
    />
  </section>
</template>
