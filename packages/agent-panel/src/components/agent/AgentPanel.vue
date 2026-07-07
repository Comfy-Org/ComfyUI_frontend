<script setup lang="ts">
import { ref } from 'vue'

import type { ComposerAttachment } from '@/composables/agent/useComposer'
import type {
  ApprovalCard,
  ConflictChoice,
  LockState
} from '@/components/agent/safety/safetyTypes'
import type { ConversationEntry } from '@/stores/agent/agentConversationStore'

import Composer from './Composer.vue'
import ConversationView from './ConversationView.vue'
import EmptyState from './EmptyState.vue'
import PanelHeader from './PanelHeader.vue'
import ApprovalCardView from './safety/ApprovalCard.vue'
import ConflictDialog from './safety/ConflictDialog.vue'
import LockBanner from './safety/LockBanner.vue'
import RevertButton from './safety/RevertButton.vue'

const {
  entries,
  userName,
  streaming = false,
  sizeMode = 'medium',
  approvalCards = [],
  lockState = 'UNLOCKED',
  conflictOpen = false,
  canRevert = false
} = defineProps<{
  entries: ConversationEntry[]
  userName?: string
  streaming?: boolean
  sizeMode?: 'medium' | 'large'
  approvalCards?: ApprovalCard[]
  lockState?: LockState
  conflictOpen?: boolean
  canRevert?: boolean
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
  close: []
  toggleSize: []
  openHistory: []
}>()

const composerRef = ref<InstanceType<typeof Composer>>()
</script>

<template>
  <section
    class="bg-agent-surface text-agent-fg flex h-full flex-col overflow-hidden"
  >
    <PanelHeader
      :size-mode="sizeMode"
      @new-chat="emit('newChat')"
      @close="emit('close')"
      @toggle-size="emit('toggleSize')"
      @open-history="emit('openHistory')"
    />

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

    <footer class="border-agent-border border-t p-3">
      <Composer
        ref="composerRef"
        :streaming="streaming"
        @send="(text, attachments) => emit('send', text, attachments)"
        @stop="emit('stop')"
        @attach="emit('attach')"
      />
    </footer>

    <ConflictDialog
      :open="conflictOpen"
      @resolve="emit('resolveConflict', $event)"
    />
  </section>
</template>
