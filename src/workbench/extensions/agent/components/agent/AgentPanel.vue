<script setup lang="ts">
import type { AgentAnswerRequest } from '@comfyorg/ingest-types'
import { useTimeout, useTimeoutFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import type {
  AgentFreeUseNoticeMetadata,
  AgentPaywallSurface,
  AgentStarterPromptAssignment,
  AgentStopMethod
} from '@/platform/telemetry/types'

import type { FreeUseVariant } from '@/workbench/extensions/agent/experiments/freeUsePlacement'
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
import type { ConversationEntry } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { AgentPanelView } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { deriveSessionTitle } from '@/workbench/extensions/agent/utils/sessionTitle'

import AgentFeedbackCaption from './AgentFeedbackCaption.vue'
import AgentSyncRetryAlert from './AgentSyncRetryAlert.vue'
import ChatHistoryScreen from './ChatHistoryScreen.vue'
import Composer from './Composer.vue'
import ConversationView from './ConversationView.vue'
import EmptyState from './EmptyState.vue'
import FreeUseNotice from './FreeUseNotice.vue'
import PanelHeader from './PanelHeader.vue'
import RunNoticeBanner from './RunNoticeBanner.vue'
import WorkflowSelectorChip from './composer/WorkflowSelectorChip.vue'
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
  nodeReferenceDisabledReason,
  availableWorkflows = [],
  selectWorkflowReference,
  savingReference = false,
  editableWorkflowId,
  activeTab = null,
  workflowTabs = [],
  visibleTabPath = null,
  followsVisibleWorkflow = false,
  selectingTabPath = null,
  selectTab = async () => false,
  workflowDetached = false,
  targetUnavailable = false,
  canvasEmptyAfterTurn = false,
  getMentionNodes = () => [],
  paywallPresentation = DEFAULT_AGENT_PAYWALL_PRESENTATION,
  creditsExhausted = false,
  sessionId = null,
  currentChatReady = false,
  customTitle,
  openingWorkflowName,
  historyGroups,
  selectHistory = async () => false,
  editableTurnId = null,
  answeringAskIds = new Set<string>(),
  freeUsePlacement = 'control',
  starterPromptAssignment = 'control',
  attributeStarterPromptExperiment = false,
  syncRetryAvailable = false
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
  followsVisibleWorkflow?: boolean
  selectingTabPath?: string | null
  selectTab?: (path: string) => Promise<boolean>
  workflowDetached?: boolean
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
  historyGroups: HistoryGroups
  selectHistory?: (id: string, isCurrent: () => boolean) => Promise<boolean>
  editableTurnId?: TurnId | null
  answeringAskIds?: ReadonlySet<string>
  freeUsePlacement?: FreeUseVariant
  starterPromptAssignment?: AgentStarterPromptAssignment
  attributeStarterPromptExperiment?: boolean
  syncRetryAvailable?: boolean
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
  standingPaywallShown: []
  newChat: []
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
  starterPromptRendered: [assignment: AgentStarterPromptAssignment]
  retrySync: []
}>()

const openingChat = computed(() => openingWorkflowName !== undefined)
const {
  ready: loadingDelayReady,
  start: startLoadingDelay,
  stop: stopLoadingDelay
} = useTimeout(120, { controls: true, immediate: false })
watch(
  openingChat,
  (opening) => {
    if (opening) startLoadingDelay()
    else stopLoadingDelay()
  },
  { immediate: true, flush: 'sync' }
)
const showChatLoading = computed(
  () => openingChat.value && loadingDelayReady.value
)

const targetNotice = computed(() => {
  if (openingChat.value) return undefined
  if (canvasEmptyAfterTurn) return 'emptyCanvas'
  if (targetUnavailable) return 'unavailable'
  if (workflowDetached || activeTab === null) return undefined
  if (visibleTabPath !== null && visibleTabPath !== activeTab.path)
    return 'mismatch'
  return followsVisibleWorkflow ? 'following' : undefined
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

function onNewChat(): void {
  view.value = { screen: 'chat' }
  emit('newChat')
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
  else if (view.value.previousThreadId === null) onNewChat()
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

const chatMenuItems = computed<MenuItem[]>(() => [
  {
    label: t('g.rename'),
    icon: 'icon-[lucide--pencil]',
    command: startRename
  },
  { separator: true },
  {
    label: t('g.delete'),
    icon: 'icon-[lucide--trash-2]',
    variant: 'destructive',
    command: onDeleteChat
  }
])

function onClose(): void {
  panelStore.interruptHistorySelection()
  emit('close')
}

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
const workflowSelectorRef = ref<InstanceType<typeof WorkflowSelectorChip>>()

function onComposerFocus(): void {
  if (runNoticeTimerPending.value || runNoticeReady.value) return
  startRunNoticeTimer()
}

function onWorkflowTargetRequired(): void {
  workflowSelectorRef.value?.openPicker()
}

const { t } = useI18n()

const sessionTitle = computed(() => customTitle || deriveSessionTitle(entries))
const displayTitle = computed(
  () => sessionTitle.value || t('agent.newChatTitle')
)

const renaming = ref(false)
const renameDraft = ref('')
const renameInput = ref<InstanceType<typeof Input>>()
const titleButton = ref<InstanceType<typeof Button>>()

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
  const button: unknown = titleButton.value?.$el
  if (button instanceof HTMLButtonElement) button.focus()
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
    class="@container flex h-full flex-col overflow-hidden bg-background text-foreground"
  >
    <PanelHeader
      :is-maximized
      @new-chat="onNewChat"
      @start-tour="emit('startTour')"
      @toggle-size="emit('toggleSize')"
      @close="onClose"
    />

    <FreeUseNotice
      v-if="!showHistory && freeUsePlacement === 'top-banner'"
      placement="top-banner"
      @notice="emit('freeUseNotice', $event)"
    />

    <template v-if="showHistory">
      <ChatHistoryScreen
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
      <div class="flex h-10 shrink-0 items-center px-2">
        <Button
          id="agent-chat-history"
          :tooltip="t('agent.showChatHistory')"
          tooltip-side="right"
          type="button"
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="t('agent.showChatHistory')"
          class="size-6 shrink-0 data-coach-hover:bg-accent"
          @click="onOpenHistory"
        >
          <span class="icon-[lucide--history] size-4 shrink-0" />
        </Button>
        <template v-if="renaming">
          <Input
            ref="renameInput"
            v-model="renameDraft"
            type="text"
            :aria-label="t('g.rename')"
            class="h-6 flex-1 px-2 py-1 text-xs"
            @keydown="onRenameKeydown"
            @blur="commitRename"
          />
        </template>
        <div
          v-else
          role="group"
          :aria-label="t('agent.chatOptions')"
          class="flex w-fit max-w-full min-w-0 items-center"
        >
          <Button
            ref="titleButton"
            type="button"
            variant="muted-textonly"
            size="sm"
            class="min-w-0 justify-start text-left"
            @click="startRename"
          >
            <span class="min-w-0 truncate">{{ displayTitle }}</span>
          </Button>
          <Menu
            v-if="sessionId"
            :items="chatMenuItems"
            side="bottom"
            align="start"
            :side-offset="4"
            class="agent-scope"
          >
            <template #trigger>
              <Button
                :tooltip="t('agent.chatOptions')"
                tooltip-side="bottom"
                variant="muted-textonly"
                size="icon-sm"
                :aria-label="t('agent.chatOptions')"
                class="size-6 shrink-0"
              >
                <span class="icon-[lucide--chevron-down] size-3" />
              </Button>
            </template>
          </Menu>
        </div>
      </div>

      <div class="relative min-h-0 flex-1">
        <EmptyState
          v-if="!entries.length"
          :aria-busy="openingChat"
          :inert="openingChat"
          :user-name
          :assignment="starterPromptAssignment"
          :attribute-experiment="attributeStarterPromptExperiment"
          @rendered="emit('starterPromptRendered', $event)"
          @insert="
            (text, prompt) => {
              composerRef?.insert(text, prompt)
            }
          "
        />
        <ConversationView
          v-else
          :aria-busy="openingChat"
          :inert="openingChat"
          :entries
          :conversation-id="sessionId"
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
          @paywall-action="emit('paywallAction', $event, 'refused_send')"
        />
        <div
          v-if="showChatLoading"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          :aria-label="
            t('agent.openingWorkflowChat', {
              workflowName: openingWorkflowName
            })
          "
          class="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/80 px-6 text-center text-sm"
        >
          <span
            aria-hidden="true"
            class="icon-[lucide--loader-circle] size-4 shrink-0 motion-safe:animate-spin"
          />
          {{
            t('agent.openingWorkflowChat', {
              workflowName: openingWorkflowName
            })
          }}
        </div>
      </div>
      <slot name="instrument" />
      <footer
        data-testid="agent-panel-footer"
        :inert="openingChat"
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
            :expanded="isMaximized"
            :workflow-name="workflowDetached ? undefined : activeTab?.name"
            :context="targetNotice"
            :generic-notice-ready="runNoticeReady"
            @show-target="emit('showTarget')"
          />
          <FreeUseNotice
            v-if="freeUsePlacement === 'near-composer'"
            placement="near-composer"
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
            :has-workflow-target="!workflowDetached"
            :workflow-selecting="selectingTabPath !== null || savingReference"
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
            <template #aboveInput>
              <FreeUseNotice
                v-if="freeUsePlacement === 'above-input'"
                placement="above-input"
                @notice="emit('freeUseNotice', $event)"
              />
            </template>
            <template #insideInput>
              <FreeUseNotice
                v-if="freeUsePlacement === 'inside-input'"
                placement="inside-input"
                @notice="emit('freeUseNotice', $event)"
              />
            </template>
          </Composer>
          <AgentFeedbackCaption />
        </div>
      </footer>
    </template>
  </section>
</template>
