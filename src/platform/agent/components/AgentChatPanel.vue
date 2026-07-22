<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import Conversation from '@/components/ai-elements/conversation/Conversation.vue'
import ConversationContent from '@/components/ai-elements/conversation/ConversationContent.vue'
import ConversationEmptyState from '@/components/ai-elements/conversation/ConversationEmptyState.vue'
import ConversationScrollButton from '@/components/ai-elements/conversation/ConversationScrollButton.vue'
import Message from '@/components/ai-elements/message/Message.vue'
import MessageAction from '@/components/ai-elements/message/MessageAction.vue'
import MessageActions from '@/components/ai-elements/message/MessageActions.vue'
import MessageAttachments from '@/components/ai-elements/message/MessageAttachments.vue'
import MessageContent from '@/components/ai-elements/message/MessageContent.vue'
import MessageResponse from '@/components/ai-elements/message/MessageResponse.vue'
import MessageThinking from '@/components/ai-elements/message/MessageThinking.vue'
import MessageToolCalls from '@/components/ai-elements/message/MessageToolCalls.vue'
import PromptInput from '@/components/ai-elements/prompt-input/PromptInput.vue'
import PromptInputAttachments from '@/components/ai-elements/prompt-input/PromptInputAttachments.vue'
import PromptInputBody from '@/components/ai-elements/prompt-input/PromptInputBody.vue'
import PromptInputButton from '@/components/ai-elements/prompt-input/PromptInputButton.vue'
import PromptInputModelSelect from '@/components/ai-elements/prompt-input/PromptInputModelSelect.vue'
import PromptInputSubmit from '@/components/ai-elements/prompt-input/PromptInputSubmit.vue'
import PromptInputTextarea from '@/components/ai-elements/prompt-input/PromptInputTextarea.vue'
import PromptInputToolbar from '@/components/ai-elements/prompt-input/PromptInputToolbar.vue'
import PromptInputTools from '@/components/ai-elements/prompt-input/PromptInputTools.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useAgentChatPrototype } from '@/platform/agent/composables/useAgentChatPrototype'
import { useMentionTrigger } from '@/platform/agent/composables/useMentionTrigger'
import { useAgentPanelStore } from '@/platform/agent/stores/agentPanelStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useAuthStore } from '@/stores/authStore'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

import AgentChatEmptyState from './AgentChatEmptyState.vue'
import AgentChatHeader from './AgentChatHeader.vue'
import AgentChatHistory from './AgentChatHistory.vue'
import AgentComposerNodeChips from './AgentComposerNodeChips.vue'
import AgentComposerPlaceholderOverlay from './AgentComposerPlaceholderOverlay.vue'
import AgentComposerWorkflowHeader from './AgentComposerWorkflowHeader.vue'
import AgentNodeMentionPicker from './AgentNodeMentionPicker.vue'
import AgentPromptSuggestions from './AgentPromptSuggestions.vue'

const {
  messages,
  input,
  status,
  isEmpty,
  chatHistory,
  currentConversationId,
  send,
  stop,
  applySuggestion,
  startNewChat,
  loadConversation,
  deleteConversation,
  copyConversation
} = useAgentChatPrototype()

const authStore = useAuthStore()
const agentPanelStore = useAgentPanelStore()
const agentNodeSelectionStore = useAgentNodeSelectionStore()

const model = ref('Auto')
const showHistory = ref(false)
const promptTextarea = ref<{
  focus: () => void
  getSelectionStart: () => number
} | null>(null)
const mentionPicker = ref<{
  moveHighlight: (delta: number) => void
  confirmHighlighted: () => void
} | null>(null)
const reactions = ref<Record<string, 'liked' | 'disliked' | null>>({})
const fileInput = ref<HTMLInputElement | null>(null)
const attachments = ref<File[]>([])

const mentionTrigger = useMentionTrigger(
  input,
  () => promptTextarea.value?.getSelectionStart() ?? 0
)

const userName = computed(
  () => authStore.currentUser?.displayName?.split(' ')[0] ?? ''
)

const conversationTitle = computed(
  () => messages.value.find((message) => message.role === 'user')?.text
)

const submitDisabled = computed(
  () => status.value === 'ready' && input.value.trim() === ''
)

function onSubmit() {
  if (status.value === 'submitted' || status.value === 'streaming') {
    stop()
    return
  }
  send(undefined, attachments.value)
  attachments.value = []
}

function removeAttachment(index: number) {
  attachments.value = attachments.value.filter((_, i) => i !== index)
}

function onAddNodesFromGraph() {
  agentNodeSelectionStore.enter()
}

function onRemoveNodeChip(node: LGraphNode) {
  agentNodeSelectionStore.removeNode(node)
}

function onMentionSelect(node: LGraphNode) {
  const range = mentionTrigger.triggerRange.value
  if (range) {
    input.value =
      input.value.slice(0, range.start) + input.value.slice(range.end)
  }
  agentNodeSelectionStore.addNode(node)
  mentionTrigger.close()
  nextTick(() => promptTextarea.value?.focus())
}

function onTextareaKeydown(event: KeyboardEvent) {
  if (!mentionTrigger.isMentionActive.value) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    mentionPicker.value?.moveHighlight(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    mentionPicker.value?.moveHighlight(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    mentionPicker.value?.confirmHighlighted()
  } else if (event.key === 'Escape') {
    mentionTrigger.close()
  }
}

function close() {
  agentPanelStore.close()
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFilesSelected(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  attachments.value = [...attachments.value, ...Array.from(files)]
  ;(e.target as HTMLInputElement).value = ''
}

function toggleReaction(id: string, reaction: 'liked' | 'disliked') {
  reactions.value[id] = reactions.value[id] === reaction ? null : reaction
}

function copyMessage(text: string) {
  navigator.clipboard.writeText(text)
}

function onSelectConversation(id: string) {
  loadConversation(id)
  showHistory.value = false
}

function onSuggestionSelect(text: string) {
  applySuggestion(text)
  setTimeout(() => promptTextarea.value?.focus(), 0)
}

function onNewChatFromHistory() {
  startNewChat()
  showHistory.value = false
  nextTick(() => promptTextarea.value?.focus())
}
</script>

<template>
  <div
    class="@container flex h-full flex-col overflow-hidden bg-base-background"
  >
    <AgentChatHeader
      :is-maximized="agentPanelStore.isMaximized"
      @new-chat="onNewChatFromHistory"
      @toggle-maximize="agentPanelStore.toggleMaximize"
      @close="close"
    />

    <template v-if="showHistory">
      <AgentChatHistory
        :conversations="chatHistory"
        :active-id="currentConversationId"
        @back="showHistory = false"
        @select="onSelectConversation"
        @delete="deleteConversation"
        @copy="copyConversation"
        @new-chat="onNewChatFromHistory"
      />
    </template>

    <template v-else>
      <div class="flex shrink-0 items-center px-2 py-1.5">
        <Tooltip :delay-duration="500">
          <TooltipTrigger>
            <button
              type="button"
              class="flex h-6 cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-secondary-background-hover"
              @click="showHistory = true"
            >
              <i class="icon-[lucide--align-justify] size-3.5" />
              <span class="max-w-56 truncate">
                {{ conversationTitle ?? $t('agent.untitledChat') }}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {{ $t('agent.history.show') }}
          </TooltipContent>
        </Tooltip>
      </div>

      <ConversationEmptyState v-if="isEmpty">
        <AgentChatEmptyState :name="userName" />
      </ConversationEmptyState>
      <Conversation v-else>
        <template #overlay>
          <ConversationScrollButton />
        </template>
        <ConversationContent class="mx-auto w-full max-w-[640px]">
          <Message
            v-for="message in messages"
            :key="message.id"
            :from="message.role"
          >
            <!-- User messages: attachments float above the text bubble -->
            <template v-if="message.role === 'user'">
              <div class="flex flex-col items-end gap-2">
                <MessageAttachments
                  v-if="message.attachments?.length"
                  :attachments="message.attachments"
                />
                <MessageContent v-if="message.text">
                  <MessageResponse
                    :content="message.text"
                    class="agent-markdown"
                  />
                </MessageContent>
              </div>
            </template>

            <!-- Assistant messages -->
            <MessageContent v-else>
              <MessageThinking v-if="message.thinking" />
              <MessageToolCalls
                v-else-if="message.toolCalls?.length"
                :tool-calls="message.toolCalls"
                :complete="
                  status === 'ready' ||
                  message !== messages[messages.length - 1]
                "
              />
              <MessageResponse
                v-if="message.text"
                :content="message.text"
                class="agent-markdown"
              />
              <MessageActions
                v-if="
                  message.text &&
                  (status === 'ready' ||
                    message !== messages[messages.length - 1])
                "
              >
                <MessageAction
                  :tooltip="$t('agent.message.thumbsUp')"
                  :pressed="reactions[message.id] === 'liked'"
                  @click="toggleReaction(message.id, 'liked')"
                >
                  <i class="icon-[lucide--thumbs-up] size-3.5" />
                </MessageAction>
                <MessageAction
                  :tooltip="$t('agent.message.thumbsDown')"
                  :pressed="reactions[message.id] === 'disliked'"
                  @click="toggleReaction(message.id, 'disliked')"
                >
                  <i class="icon-[lucide--thumbs-down] size-3.5" />
                </MessageAction>
                <MessageAction
                  :tooltip="$t('agent.message.copy')"
                  @click="copyMessage(message.text)"
                >
                  <i class="icon-[lucide--copy] size-3.5" />
                </MessageAction>
              </MessageActions>
            </MessageContent>
          </Message>
        </ConversationContent>
      </Conversation>

      <div class="flex shrink-0 flex-col gap-4 p-4">
        <div
          class="@container mx-auto flex w-full max-w-[640px] flex-col gap-4"
        >
          <AgentPromptSuggestions v-if="isEmpty" @select="onSuggestionSelect" />
          <div class="flex flex-col gap-2.5">
            <PromptInput @submit="onSubmit">
              <AgentComposerWorkflowHeader />
              <PromptInputBody>
                <AgentComposerNodeChips
                  :nodes="agentNodeSelectionStore.referencedNodes"
                  @remove="onRemoveNodeChip"
                />
                <PromptInputAttachments
                  :attachments="attachments"
                  @remove="removeAttachment"
                />
                <div class="relative">
                  <AgentComposerPlaceholderOverlay
                    v-if="!input"
                    @add-nodes-from-graph="onAddNodesFromGraph"
                  />
                  <PromptInputTextarea
                    ref="promptTextarea"
                    v-model="input"
                    :aria-label="$t('agent.placeholderAria')"
                    @keydown="onTextareaKeydown"
                  />
                  <AgentNodeMentionPicker
                    v-if="mentionTrigger.isMentionActive.value"
                    ref="mentionPicker"
                    :nodes="agentNodeSelectionStore.graphNodes"
                    :query="mentionTrigger.mentionQuery.value"
                    @select="onMentionSelect"
                  />
                </div>
                <PromptInputToolbar>
                  <PromptInputTools>
                    <input
                      ref="fileInput"
                      type="file"
                      multiple
                      class="hidden"
                      @change="onFilesSelected"
                    />
                    <Tooltip :delay-duration="500">
                      <TooltipTrigger>
                        <PromptInputButton
                          :aria-label="$t('agent.attach')"
                          @click="openFilePicker"
                        >
                          <i class="icon-[lucide--paperclip] size-4" />
                        </PromptInputButton>
                      </TooltipTrigger>
                      <TooltipContent side="top" class="whitespace-nowrap">
                        {{ $t('agent.attach') }}
                      </TooltipContent>
                    </Tooltip>
                  </PromptInputTools>
                  <PromptInputTools>
                    <PromptInputModelSelect v-model="model" />
                    <PromptInputSubmit
                      :status="status"
                      :disabled="submitDisabled"
                    />
                  </PromptInputTools>
                </PromptInputToolbar>
              </PromptInputBody>
            </PromptInput>
            <p class="my-0 text-center text-xs text-muted-foreground">
              {{ $t('agent.disclaimer') }}
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
