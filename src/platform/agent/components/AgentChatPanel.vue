<script setup lang="ts">
import { computed, ref } from 'vue'

import Conversation from '@/components/ai-elements/conversation/Conversation.vue'
import ConversationContent from '@/components/ai-elements/conversation/ConversationContent.vue'
import ConversationEmptyState from '@/components/ai-elements/conversation/ConversationEmptyState.vue'
import ConversationScrollButton from '@/components/ai-elements/conversation/ConversationScrollButton.vue'
import Loader from '@/components/ai-elements/loader/Loader.vue'
import Message from '@/components/ai-elements/message/Message.vue'
import MessageContent from '@/components/ai-elements/message/MessageContent.vue'
import MessageResponse from '@/components/ai-elements/message/MessageResponse.vue'
import PromptInput from '@/components/ai-elements/prompt-input/PromptInput.vue'
import PromptInputBody from '@/components/ai-elements/prompt-input/PromptInputBody.vue'
import PromptInputButton from '@/components/ai-elements/prompt-input/PromptInputButton.vue'
import PromptInputModelSelect from '@/components/ai-elements/prompt-input/PromptInputModelSelect.vue'
import PromptInputSubmit from '@/components/ai-elements/prompt-input/PromptInputSubmit.vue'
import PromptInputTextarea from '@/components/ai-elements/prompt-input/PromptInputTextarea.vue'
import PromptInputToolbar from '@/components/ai-elements/prompt-input/PromptInputToolbar.vue'
import PromptInputTools from '@/components/ai-elements/prompt-input/PromptInputTools.vue'
import { useAgentChatPrototype } from '@/platform/agent/composables/useAgentChatPrototype'
import { useAgentPanelStore } from '@/platform/agent/stores/agentPanelStore'
import { useAuthStore } from '@/stores/authStore'

import AgentChatEmptyState from './AgentChatEmptyState.vue'
import AgentChatHeader from './AgentChatHeader.vue'
import AgentChatHistory from './AgentChatHistory.vue'
import AgentPromptSuggestions from './AgentPromptSuggestions.vue'

const {
  messages,
  input,
  status,
  isEmpty,
  chatHistory,
  send,
  stop,
  applySuggestion,
  startNewChat
} = useAgentChatPrototype()

const authStore = useAuthStore()
const agentPanelStore = useAgentPanelStore()

const model = ref('Auto')
const showHistory = ref(false)

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
  send()
}

function close() {
  agentPanelStore.close()
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-base-background">
    <AgentChatHeader @new-chat="startNewChat" @close="close" />

    <template v-if="showHistory">
      <AgentChatHistory
        :conversations="chatHistory"
        :current-title="conversationTitle"
        @back="showHistory = false"
        @select="showHistory = false"
      />
    </template>

    <template v-else>
      <div class="flex shrink-0 items-center px-2 py-1.5">
        <button
          type="button"
          class="flex h-6 items-center gap-1 rounded-sm border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-secondary-background-hover"
          @click="showHistory = true"
        >
          <i class="icon-[lucide--align-justify] size-3.5" />
          <span class="max-w-56 truncate">
            {{ conversationTitle ?? $t('agent.newChat') }}
          </span>
        </button>
      </div>

      <ConversationEmptyState v-if="isEmpty">
        <AgentChatEmptyState :name="userName" />
      </ConversationEmptyState>
      <Conversation v-else>
        <ConversationContent>
          <Message
            v-for="message in messages"
            :key="message.id"
            :from="message.role"
          >
            <MessageContent>
              <MessageResponse :content="message.text" />
            </MessageContent>
          </Message>
          <Loader v-if="status === 'submitted'" />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div class="flex shrink-0 flex-col gap-4 p-4">
        <div
          class="@container mx-auto flex w-full max-w-[640px] flex-col gap-4"
        >
          <AgentPromptSuggestions v-if="isEmpty" @select="applySuggestion" />
          <div class="flex flex-col gap-2.5">
            <PromptInput @submit="onSubmit">
              <PromptInputBody>
                <PromptInputTextarea
                  v-model="input"
                  :placeholder="$t('agent.placeholder')"
                />
                <PromptInputToolbar>
                  <PromptInputTools>
                    <PromptInputButton :aria-label="$t('agent.attach')">
                      <i class="icon-[lucide--paperclip] size-4" />
                    </PromptInputButton>
                    <PromptInputButton :aria-label="$t('agent.mention')">
                      <i class="icon-[lucide--at-sign] size-4" />
                    </PromptInputButton>
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
