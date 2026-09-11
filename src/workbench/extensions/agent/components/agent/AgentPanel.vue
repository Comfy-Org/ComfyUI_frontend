<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Input from '@/components/ui/input/Input.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'

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
  stop: []
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
  openWorkflow: [workflowId: string, workflowName?: string]
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
const renameInput = ref<InstanceType<typeof Input>>()
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
      <div class="flex h-10 shrink-0 items-center px-2">
        <button
          v-tooltip.bottom="buildTooltipConfig(t('agent.showChatHistory'))"
          type="button"
          :aria-label="t('agent.showChatHistory')"
          class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:outline-none"
          @click="onOpenHistory"
        >
          <span class="icon-[lucide--history] size-4 shrink-0" />
        </button>
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
          <button
            ref="titleButton"
            type="button"
            :disabled="sessionId === null"
            class="flex h-6 min-w-0 cursor-pointer items-center rounded-sm px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            @click="startRename"
          >
            <span class="min-w-0 truncate">{{
              sessionTitle || t('agent.newChatTitle')
            }}</span>
          </button>
          <DropdownMenuRoot v-if="sessionId">
            <DropdownMenuTrigger
              v-tooltip.bottom="buildTooltipConfig(t('agent.chatOptions'))"
              :aria-label="t('agent.chatOptions')"
              class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground"
            >
              <span class="icon-[lucide--chevron-down] size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                side="bottom"
                align="start"
                :side-offset="4"
                class="agent-scope z-1100 flex h-16 w-32 flex-col gap-1 rounded-xl bg-secondary-background p-1 shadow-lg"
              >
                <DropdownMenuItem
                  class="flex h-6 w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
                  @select="startRename"
                >
                  <span class="icon-[lucide--pencil] size-4 shrink-0" />
                  <span class="truncate">{{ t('g.rename') }}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator
                  class="relative h-0 w-full shrink-0 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-component-node-border"
                />
                <DropdownMenuItem
                  class="flex h-6 w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-base-foreground outline-none data-highlighted:bg-secondary-background-hover data-highlighted:text-destructive-background"
                  @select="onDeleteChat"
                >
                  <span class="icon-[lucide--trash-2] size-4 shrink-0" />
                  <span class="truncate">{{ t('g.delete') }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </div>
      </div>

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
          @open-workflow="
            (workflowId, workflowName) =>
              emit('openWorkflow', workflowId, workflowName)
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
            @stop="emit('stop')"
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
          <p class="-mt-1.5 mb-0 text-center text-xs text-muted-foreground">
            {{ t(isMaximized ? 'agent.captionExpanded' : 'agent.caption') }}
          </p>
        </div>
      </footer>
    </template>
  </section>
</template>
