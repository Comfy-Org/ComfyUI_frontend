<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Input from '@comfyorg/design-system/input/Input'
import Menu from '@comfyorg/design-system/menu/Menu'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'

const {
  title,
  hasChat = false,
  canPin = false,
  pinned = false
} = defineProps<{
  title?: string
  hasChat?: boolean
  canPin?: boolean
  pinned?: boolean
}>()

const emit = defineEmits<{
  rename: [title: string]
  delete: []
  togglePin: []
}>()

const { t } = useI18n()

const renaming = ref(false)
const renameDraft = ref('')
const renameInput = ref<InstanceType<typeof Input>>()
const titleButton = ref<InstanceType<typeof Button>>()

async function startRename(): Promise<void> {
  renameDraft.value = title ?? ''
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
  const next = renameDraft.value.trim()
  if (next !== '' && next !== title) emit('rename', next)
}

const menuItems = computed<MenuItem[]>(() => [
  ...(canPin
    ? [
        {
          label: pinned ? t('agent.sidebar.unpin') : t('agent.sidebar.pin'),
          icon: pinned ? 'icon-[lucide--pin-off]' : 'icon-[lucide--pin]',
          command: () => emit('togglePin')
        }
      ]
    : []),
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
    command: () => emit('delete')
  }
])
</script>

<template>
  <Input
    v-if="renaming"
    ref="renameInput"
    v-model="renameDraft"
    type="text"
    :aria-label="t('g.rename')"
    class="h-6 flex-1 px-2 py-1 text-xs"
    @keydown="onRenameKeydown"
    @blur="commitRename"
  />
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
      :disabled="!hasChat"
      class="min-w-0 justify-start text-left"
      @click="startRename"
    >
      <span class="min-w-0 truncate">{{
        title || t('agent.newChatTitle')
      }}</span>
    </Button>
    <Menu
      v-if="hasChat"
      :items="menuItems"
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
          <i aria-hidden="true" class="icon-[lucide--chevron-down] size-3" />
        </Button>
      </template>
    </Menu>
  </div>
</template>
