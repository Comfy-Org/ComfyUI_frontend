<script setup lang="ts">
import { computed, ref } from 'vue'

import type { AgentStopMethod } from '@/platform/telemetry/types'

import type { ActiveTab } from '../../types/activeTab'
import type {
  WorkflowReference,
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '../../types/workflowReference'
import type { TurnId } from '../../schemas/agentApiSchema'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { DEFAULT_AGENT_PAYWALL_PRESENTATION } from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'
import type { HistoryGroups } from '../../stores/agent/agentChatHistoryStore'

import AgentFeedbackCaption from './AgentFeedbackCaption.vue'
import ChatTitleBar from './ChatTitleBar.vue'
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
  nodeReferenceDisabledReason,
  availableWorkflows = [],
  selectWorkflowReference,
  savingReference = false,
  editableWorkflowId,
  activeTab = null,
  workflowTabs = [],
  visibleTabPath = null,
  selectingTabPath = null,
  selectTab = async () => false,
  workflowDetached = false,
  getMentionNodes = () => [],
  paywallPresentation = DEFAULT_AGENT_PAYWALL_PRESENTATION,
  sessionId = null,
  customTitle,
  historyGroups,
  editableTurnId = null,
  answeringAskIds = new Set<string>()
} = defineProps<{
  entries: ConversationEntry[]
  userName?: string
  streaming?: boolean
  submitting?: boolean
  canAttach?: boolean
  canOpenAssets?: boolean
  isMaximized?: boolean
  selectionTags?: SelectedNode[]
  nodeReferenceDisabledReason?: string
  availableWorkflows?: WorkflowReferenceOption[]
  selectWorkflowReference?: (
    workflow: WorkflowReferenceOption
  ) => Promise<WorkflowReferenceMetadata | undefined>
  savingReference?: boolean
  editableWorkflowId?: string
  activeTab?: ActiveTab | null
  workflowTabs?: ActiveTab[]
  visibleTabPath?: string | null
  selectingTabPath?: string | null
  selectTab?: (path: string) => Promise<boolean>
  workflowDetached?: boolean
  getMentionNodes?: () => SelectedNode[]
  paywallPresentation?: AgentPaywallPresentation
  sessionId?: string | null
  customTitle?: string
  historyGroups: HistoryGroups
  editableTurnId?: TurnId | null
  answeringAskIds?: ReadonlySet<string>
}>()
const emit = defineEmits<{
  send: [
    text: string,
    attachments: ComposerAttachment[],
    workflowReferences?: WorkflowReference[]
  ]
  stop: [method: AgentStopMethod]
  attach: []
  openAssets: []
  selectNodes: []
  removeTag: [id: string]
  mentionPick: [node: SelectedNode]
  requestWorkflowReferences: []
  removeWorkflowReference: [id: string]
  feedback: [turnId: string, vote: 'up' | 'down' | null]
  paywallAction: [action: AgentPaywallAction]
  newChat: []
  toggleSize: []
  close: []
  openHistory: []
  selectHistory: [id: string]
  deleteHistory: [id: string]
  copyHistory: [id: string]
  renameHistory: [id: string, title: string]
  renameChat: [title: string]
  answerAsk: [askId: string, selection: 'run' | 'cancel']
  openWorkflow: [askId: string, workflowId: string, workflowName?: string]
  approvalShown: [askId: string, turnId: string, workflowId: string | null]
  openReferenceWorkflow: [workflowId: string, workflowName: string]
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
const workflowSelectorRef = ref<InstanceType<typeof WorkflowSelectorChip>>()

function onWorkflowTargetRequired(): void {
  workflowSelectorRef.value?.openPicker()
}

const sessionTitle = computed(() => {
  if (customTitle) return customTitle
  const firstUser = entries.find(
    (entry): entry is Extract<ConversationEntry, { role: 'user' }> =>
      entry.role === 'user'
  )
  return firstUser?.text.trim().slice(0, 60) || undefined
})

function onDeleteChat(): void {
  if (sessionId !== null) emit('deleteHistory', sessionId)
}

function addAttachment(attachment: ComposerAttachment): boolean {
  return composerRef.value?.addAttachment(attachment) ?? false
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

function onComposerSend(
  text: string,
  attachments: ComposerAttachment[],
  references?: WorkflowReference[]
): void {
  if (references !== undefined) emit('send', text, attachments, references)
  else emit('send', text, attachments)
}

defineExpose({ addAttachment, updateAttachment, removeAttachment })
</script>

<template>
  <section
    class="@container flex h-full flex-col overflow-hidden bg-base-background text-base-foreground"
  >
    <PanelHeader
      :is-maximized
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
        @rename="(id, title) => emit('renameHistory', id, title)"
      />
    </template>

    <template v-else>
      <ChatTitleBar
        :title="sessionTitle"
        :session-id
        @open-history="onOpenHistory"
        @rename="emit('renameChat', $event)"
        @delete="onDeleteChat"
      />

      <div class="min-h-0 flex-1">
        <EmptyState
          v-if="!entries.length"
          :user-name
          @insert="composerRef?.insert($event)"
        />
        <ConversationView
          v-else
          :entries
          :editable-turn-id
          :answering-ask-ids
          :paywall-presentation
          @edit-prompt="composerRef?.replaceDraft($event)"
          @feedback="(id, vote) => emit('feedback', id, vote)"
          @answer-ask="
            (askId, selection) => emit('answerAsk', askId, selection)
          "
          @approval-shown="
            (askId, turnId, workflowId) =>
              emit('approvalShown', askId, turnId, workflowId)
          "
          @open-workflow="
            (askId, workflowId, workflowName) =>
              emit('openWorkflow', askId, workflowId, workflowName)
          "
          @open-reference-workflow="
            (workflowId, workflowName) =>
              emit('openReferenceWorkflow', workflowId, workflowName)
          "
          @paywall-action="emit('paywallAction', $event)"
        />
      </div>
    </template>

    <template v-if="!showHistory">
      <slot name="instrument" />
      <footer class="shrink-0 py-3">
        <div class="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4">
          <RunNoticeBanner
            :expanded="isMaximized"
            :workflow-name="workflowDetached ? undefined : activeTab?.name"
          />
          <Composer
            ref="composerRef"
            :streaming
            :submitting
            :can-attach
            :can-open-assets
            :selection-tags
            :node-reference-disabled-reason
            :select-workflow-reference
            :available-workflows
            :editable-workflow-id
            :has-workflow-target="!workflowDetached"
            :workflow-selecting="selectingTabPath !== null || savingReference"
            :get-mention-nodes
            @send="onComposerSend"
            @stop="emit('stop', $event)"
            @attach="emit('attach')"
            @open-assets="emit('openAssets')"
            @select-nodes="emit('selectNodes')"
            @remove-tag="emit('removeTag', $event)"
            @mention-pick="emit('mentionPick', $event)"
            @request-workflow-references="emit('requestWorkflowReferences')"
            @remove-workflow-reference="emit('removeWorkflowReference', $event)"
            @open-reference-workflow="
              (workflowId, workflowName) =>
                emit('openReferenceWorkflow', workflowId, workflowName)
            "
            @workflow-target-required="onWorkflowTargetRequired"
          >
            <template #header>
              <WorkflowSelectorChip
                ref="workflowSelectorRef"
                :active-tab
                :tabs="workflowTabs"
                :visible-tab-path
                :selecting-tab-path
                :select-tab
                :detached="workflowDetached"
                :disabled="streaming || submitting || savingReference"
              />
            </template>
          </Composer>
          <AgentFeedbackCaption />
        </div>
      </footer>
    </template>
  </section>
</template>
