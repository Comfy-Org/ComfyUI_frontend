<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Input from '@comfyorg/design-system/input/Input'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import Menu from '@comfyorg/design-system/menu/Menu'

import type { ConversationEntry } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { deriveSessionTitle } from '@/workbench/extensions/agent/utils/sessionTitle'

const {
  blocked = false,
  sessionId = null,
  chatKey,
  customTitle,
  entries
} = defineProps<{
  blocked?: boolean
  sessionId?: string | null
  chatKey?: string
  customTitle?: string
  entries: ConversationEntry[]
}>()

const emit = defineEmits<{
  openHistory: []
  renameChat: [title: string]
  deleteChat: [id: string]
}>()

const { t } = useI18n()

const activeChatKey = computed(() => chatKey ?? sessionId ?? '')
const sessionTitle = computed(() => customTitle || deriveSessionTitle(entries))
const displayTitle = computed(
  () => sessionTitle.value || t('agent.newChatTitle')
)

const renaming = ref(false)
const renameDraft = ref('')
let renameChatKey: string | null = null
const renameInput = ref<InstanceType<typeof Input>>()
const titleButton = ref<InstanceType<typeof Button>>()

watch(
  activeChatKey,
  () => {
    if (!renaming.value) return
    renaming.value = false
    renameChatKey = null
  },
  { flush: 'sync' }
)

async function startRename(): Promise<void> {
  renameChatKey = activeChatKey.value
  renameDraft.value = sessionTitle.value ?? ''
  renaming.value = true
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

async function exitRename(): Promise<void> {
  renaming.value = false
  renameChatKey = null
  await nextTick()
  const button: unknown = titleButton.value?.$el
  if (button instanceof HTMLButtonElement) button.focus()
}

function onRenameKeydown(event: KeyboardEvent): void {
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
  if (renameChatKey !== activeChatKey.value) {
    renaming.value = false
    renameChatKey = null
    return
  }
  void exitRename()
  const title = renameDraft.value.trim()
  if (title !== '' && title !== sessionTitle.value) emit('renameChat', title)
}

function onDeleteChat(): void {
  if (sessionId !== null) emit('deleteChat', sessionId)
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
</script>

<template>
  <div
    data-testid="agent-panel-chat-controls"
    :inert="blocked"
    class="flex h-10 shrink-0 items-center px-2"
  >
    <Button
      id="agent-chat-history"
      :tooltip="t('agent.showChatHistory')"
      tooltip-side="right"
      type="button"
      variant="muted-textonly"
      size="icon-sm"
      :aria-label="t('agent.showChatHistory')"
      class="shrink-0 data-coach-hover:bg-accent"
      @click="emit('openHistory')"
    >
      <i aria-hidden="true" class="icon-[lucide--history]" />
    </Button>
    <template v-if="renaming">
      <Input
        ref="renameInput"
        v-model="renameDraft"
        type="text"
        :aria-label="t('g.rename')"
        class="flex-1"
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
            class="shrink-0"
          >
            <i aria-hidden="true" class="icon-[lucide--chevron-down] size-3" />
          </Button>
        </template>
      </Menu>
    </div>
  </div>
</template>
