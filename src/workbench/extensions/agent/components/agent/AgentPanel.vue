<script setup lang="ts">
import type { AgentAnswerRequest } from '@comfyorg/ingest-types'
import { useTimeoutFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'

import type {
  AgentFreeUseNoticeMetadata,
  AgentPaywallSurface,
  AgentStopMethod
} from '@comfyorg/telemetry/types'

import type { FreeUseVariant } from '@/workbench/extensions/agent/experiments/freeUsePlacement'
import type { AgentGreeting } from '@/workbench/extensions/agent/types/proactiveGreeting'
import type { ActiveTab } from '@/workbench/extensions/agent/types/activeTab'
import type {
  WorkflowReference,
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '@/workbench/extensions/agent/types/workflowReference'
import type { TurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'
import type { SelectedNode } from '@/workbench/extensions/agent/composables/agent/useCanvasSelection'
import { DEFAULT_AGENT_PAYWALL_PRESENTATION } from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type { FollowLanding } from '@/workbench/extensions/agent/composables/agent/useAgentWorkflowChatFollow'
import type { ConversationEntry } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { AgentPanelView } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import AgentFeedbackCaption from './AgentFeedbackCaption.vue'
import AgentPanelChatControls from './AgentPanelChatControls.vue'
import AgentSyncRetryAlert from './AgentSyncRetryAlert.vue'
import ChatHistoryScreen from './ChatHistoryScreen.vue'
import Composer from './Composer.vue'
import ConversationView from './ConversationView.vue'
import FreeUseNotice from './FreeUseNotice.vue'
import NewChatScreen from './NewChatScreen.vue'
import PanelHeader from './PanelHeader.vue'
import RunNoticeBanner from './RunNoticeBanner.vue'
import AgentPaywallCard from './message/AgentPaywallCard.vue'

const {
  entries,
  userName,
  streaming = false,
  submitting = false,
  canAttach = false,
  canOpenAssets = false,
  isMaximized = false,
  selectionTags = [],
  hasNodeSelectionModeAddition = false,
  nodeReferenceDisabledReason,
  availableWorkflows = [],
  selectWorkflowReference,
  savingReference = false,
  editableWorkflowId,
  activeTab = null,
  visibleTabPath = null,
  workflowDetached = false,
  targetRestoring = false,
  targetUnavailable = false,
  canvasEmptyAfterTurn = false,
  getMentionNodes = () => [],
  paywallPresentation = DEFAULT_AGENT_PAYWALL_PRESENTATION,
  creditsExhausted = false,
  sessionId = null,
  currentChatReady = false,
  customTitle,
  openingWorkflowName,
  landing = null,
  historyGroups,
  selectHistory = async () => false,
  editableTurnId = null,
  answeringAskIds = new Set<string>(),
  freeUsePlacement = 'control',
  syncRetryAvailable = false,
  retryBlocked = false,
  greeting,
  blocked = false
} = defineProps<{
  entries: ConversationEntry[]
  userName?: string
  streaming?: boolean
  submitting?: boolean
  canAttach?: boolean
  canOpenAssets?: boolean
  isMaximized?: boolean
  selectionTags?: SelectedNode[]
  hasNodeSelectionModeAddition?: boolean
  nodeReferenceDisabledReason?: string
  availableWorkflows?: WorkflowReferenceOption[]
  selectWorkflowReference?: (
    workflow: WorkflowReferenceOption
  ) => Promise<WorkflowReferenceMetadata | undefined>
  savingReference?: boolean
  editableWorkflowId?: string
  activeTab?: ActiveTab | null
  visibleTabPath?: string | null
  workflowDetached?: boolean
  targetRestoring?: boolean
  targetUnavailable?: boolean
  canvasEmptyAfterTurn?: boolean
  getMentionNodes?: () => SelectedNode[]
  paywallPresentation?: AgentPaywallPresentation
  /**
   * The workspace is out of credits right now, and no inline paywall card is
   * already on screen saying so. Renders the standing surface beside the
   * composer; see AgentPanelRoot's `creditsExhausted` for why it exists.
   */
  creditsExhausted?: boolean
  sessionId?: string | null
  currentChatReady?: boolean
  customTitle?: string
  openingWorkflowName?: string
  landing?: FollowLanding | null
  historyGroups: HistoryGroups
  selectHistory?: (id: string, isCurrent: () => boolean) => Promise<boolean>
  editableTurnId?: TurnId | null
  answeringAskIds?: ReadonlySet<string>
  freeUsePlacement?: FreeUseVariant
  syncRetryAvailable?: boolean
  retryBlocked?: boolean
  greeting?: AgentGreeting
  blocked?: boolean
}>()
const emit = defineEmits<{
  send: [
    text: string,
    attachments: ComposerAttachment[],
    workflowReferences?: WorkflowReference[]
  ]
  stop: [method: AgentStopMethod]
  attach: []
  attachFiles: [files: File[]]
  removeAttachment: [id: string]
  openAssets: []
  selectNodes: []
  removeTag: [id: string]
  mentionPick: [node: SelectedNode]
  requestWorkflowReferences: []
  removeWorkflowReference: [id: string]
  feedback: [turnId: string, vote: 'up' | 'down' | null]
  paywallAction: [action: AgentPaywallAction, surface: AgentPaywallSurface]
  retryPending: [clientMessageId: string]
  deletePending: [clientMessageId: string]
  standingPaywallShown: []
  newChat: [source: 'new_chat_button' | 'history_back']
  startTour: []
  toggleSize: []
  close: []
  openHistory: []
  deleteHistory: [id: string]
  copyHistory: [id: string]
  renameHistory: [id: string, title: string]
  renameChat: [title: string]
  answerAsk: [askId: string, answer: AgentAnswerRequest]
  openWorkflow: [askId: string, workflowId: string, workflowName?: string]
  approvalShown: [askId: string, turnId: string, workflowId: string | null]
  openReferenceWorkflow: [workflowId: string, workflowName: string]
  showTarget: []
  freeUseNotice: [metadata: AgentFreeUseNoticeMetadata]
  retrySync: []
  retryLanding: []
}>()

const openingChat = computed(() => openingWorkflowName !== undefined)
const boundToTab = computed(() => !workflowDetached && activeTab !== null)

const detachedChatUnavailable = computed(
  () => workflowDetached && sessionId !== null && !targetRestoring
)

const targetNotice = computed(() => {
  if (openingChat.value) return undefined
  if (canvasEmptyAfterTurn) return 'emptyCanvas'
  if (targetUnavailable || detachedChatUnavailable.value) return 'unavailable'
  if (!boundToTab.value) return undefined
  if (visibleTabPath !== null && visibleTabPath !== activeTab?.path)
    return 'mismatch'
  return undefined
})

const panelStore = useAgentPanelStore()
const { view } = storeToRefs(panelStore)
const showHistory = computed(() => view.value.screen === 'history')
const loadingHistoryId = computed(() =>
  view.value.screen === 'history' && view.value.selection.status === 'loading'
    ? view.value.selection.id
    : null
)
const failedHistoryId = computed(() =>
  view.value.screen === 'history' && view.value.selection.status === 'failed'
    ? view.value.selection.id
    : null
)
onScopeDispose(panelStore.interruptHistorySelection)

watch(
  [showHistory, () => creditsExhausted],
  ([historyVisible, exhausted]) => {
    if (!historyVisible && exhausted) emit('standingPaywallShown')
  },
  { immediate: true }
)

function onNewChat(
  source: 'new_chat_button' | 'history_back' = 'new_chat_button'
): void {
  view.value = { screen: 'chat' }
  emit('newChat', source)
}
function onOpenHistory(): void {
  view.value = {
    screen: 'history',
    previousThreadId: sessionId,
    selection: { status: 'idle' }
  }
  emit('openHistory')
}
async function openHistoryChat(
  id: string,
  onFailure: 'stay' | 'leave'
): Promise<void> {
  if (view.value.screen !== 'history' || loadingHistoryId.value === id) return
  const opening: AgentPanelView = {
    ...view.value,
    selection: { status: 'loading', id }
  }
  view.value = opening
  const isCurrent = () => view.value === opening
  let opened = false
  try {
    opened = await selectHistory(id, isCurrent)
  } finally {
    if (isCurrent())
      view.value =
        opened || onFailure === 'leave'
          ? { screen: 'chat' }
          : { ...opening, selection: { status: 'failed', id } }
  }
}

function onSelectHistory(id: string): Promise<void> {
  return openHistoryChat(id, 'stay')
}

function onBackFromHistory(): void {
  if (view.value.screen !== 'history') return
  if (
    sessionId === view.value.previousThreadId &&
    (view.value.selection.status === 'idle' || currentChatReady)
  )
    view.value = { screen: 'chat' }
  else if (view.value.previousThreadId === null) onNewChat('history_back')
  else void openHistoryChat(view.value.previousThreadId, 'leave')
}

function onDeleteHistory(id: string): void {
  if (
    view.value.screen === 'history' &&
    (view.value.previousThreadId === id ||
      (view.value.selection.status !== 'idle' &&
        view.value.selection.id === id))
  )
    view.value = {
      ...view.value,
      previousThreadId:
        view.value.previousThreadId === id ? null : view.value.previousThreadId,
      selection: { status: 'idle' }
    }
  emit('deleteHistory', id)
}

function onClose(): void {
  panelStore.interruptHistorySelection()
  emit('close')
}

const visibleGreeting = computed(() =>
  !entries.length && !openingChat.value && landing === null
    ? greeting
    : undefined
)
const greetingReplacesIntro = computed(
  () =>
    visibleGreeting.value !== undefined && visibleGreeting.value.variant !== 'A'
)

const composerRef = ref<InstanceType<typeof Composer>>()
const runNoticeReady = ref(false)
const { isPending: runNoticeTimerPending, start: startRunNoticeTimer } =
  useTimeoutFn(
    () => {
      runNoticeReady.value = true
    },
    500,
    {
      immediate: false
    }
  )

function onComposerFocus(): void {
  if (runNoticeTimerPending.value || runNoticeReady.value) return
  startRunNoticeTimer()
}

const footerInert = computed(() => openingChat.value || blocked)

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

async function onGreetingPrefilled(delayMs: number): Promise<void> {
  const current = visibleGreeting.value
  await nextTick()
  if (current !== visibleGreeting.value) return
  await composerRef.value?.focusPrefill(delayMs)
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
    class="@container flex h-full flex-col overflow-hidden bg-background text-foreground"
  >
    <PanelHeader
      :is-maximized
      @new-chat="onNewChat"
      @start-tour="emit('startTour')"
      @toggle-size="emit('toggleSize')"
      @close="onClose"
    />

    <slot name="panelNotice" />

    <template v-if="showHistory">
      <ChatHistoryScreen
        :inert="blocked"
        :groups="historyGroups"
        :loading-id="loadingHistoryId"
        :failed-id="failedHistoryId"
        class="min-h-0 flex-1"
        @back="onBackFromHistory"
        @select="onSelectHistory"
        @delete="onDeleteHistory"
        @copy-markdown="emit('copyHistory', $event)"
        @rename="(id, title) => emit('renameHistory', id, title)"
      />
    </template>

    <template v-else>
      <AgentPanelChatControls
        :blocked
        :session-id
        :custom-title
        :entries
        @open-history="onOpenHistory"
        @rename-chat="emit('renameChat', $event)"
        @delete-chat="emit('deleteHistory', $event)"
      />

      <div :inert="blocked" class="relative min-h-0 flex-1">
        <ConversationView
          v-if="entries.length && !openingChat"
          :entries
          :conversation-id="sessionId"
          :editable-turn-id
          :answering-ask-ids
          :retry-blocked
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
          @paywall-action="
            (action, surface) => emit('paywallAction', action, surface)
          "
          @retry-pending="emit('retryPending', $event)"
          @delete-pending="emit('deletePending', $event)"
          @new-chat="emit('newChat', 'new_chat_button')"
        />
        <NewChatScreen
          v-else
          :opening-workflow-name
          :landing
          :user-name
          :greeting="visibleGreeting"
          :has-selection="hasNodeSelectionModeAddition"
          @prefilled="onGreetingPrefilled"
          @insert="
            (text, prompt) => {
              composerRef?.insert(text, prompt)
            }
          "
          @retry="emit('retryLanding')"
        />
      </div>
      <slot name="instrument" />
      <footer
        data-testid="agent-panel-footer"
        :inert="footerInert"
        class="shrink-0 py-3 inert:opacity-50"
      >
        <div
          data-testid="agent-composer-stack"
          class="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4"
        >
          <AgentSyncRetryAlert
            :visible="syncRetryAvailable"
            @retry="emit('retrySync')"
          />
          <slot name="composerNotice" />
          <AgentPaywallCard
            v-if="creditsExhausted"
            data-testid="agent-credits-exhausted-paywall"
            :presentation="paywallPresentation"
            @paywall-action="emit('paywallAction', $event, 'credits_exhausted')"
          />
          <RunNoticeBanner
            :hide-intro="greetingReplacesIntro || boundToTab"
            :expanded="isMaximized"
            :workflow-name="activeTab?.name"
            :context="targetNotice"
            :generic-notice-ready="runNoticeReady"
            @show-target="emit('showTarget')"
            @new-chat="onNewChat()"
          />
          <FreeUseNotice
            v-if="freeUsePlacement === 'near-composer'"
            @notice="emit('freeUseNotice', $event)"
          />
          <Composer
            ref="composerRef"
            :streaming
            :submitting
            :opening-chat
            :can-attach
            :can-open-assets
            :selection-tags
            :node-reference-disabled-reason
            :select-workflow-reference
            :available-workflows
            :editable-workflow-id
            :has-workflow-target="!workflowDetached && !targetUnavailable"
            :workflow-selecting="savingReference"
            :get-mention-nodes
            @focusin="onComposerFocus"
            @send="onComposerSend"
            @stop="emit('stop', $event)"
            @attach="emit('attach')"
            @attach-files="emit('attachFiles', $event)"
            @remove-attachment="emit('removeAttachment', $event)"
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
          />
          <AgentFeedbackCaption />
        </div>
      </footer>
    </template>
  </section>
</template>
