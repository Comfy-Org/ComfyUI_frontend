<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'

const { title, sessionId } = defineProps<{
  title?: string
  sessionId: string | null
}>()
const emit = defineEmits<{
  openHistory: []
  rename: [title: string]
  delete: []
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

function commitRename(): void {
  if (!renaming.value) return
  void exitRename()
  const nextTitle = renameDraft.value.trim()
  if (nextTitle !== '' && nextTitle !== title) emit('rename', nextTitle)
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
</script>

<template>
  <div class="flex h-10 shrink-0 items-center px-2">
    <Tooltip
      :config="buildTooltipConfig(t('agent.showChatHistory'))"
      side="bottom"
    >
      <Button
        id="agent-chat-history"
        type="button"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('agent.showChatHistory')"
        class="size-6 shrink-0"
        @click="emit('openHistory')"
      >
        <span class="icon-[lucide--history] size-4 shrink-0" />
      </Button>
    </Tooltip>
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
        :disabled="sessionId === null"
        class="min-w-0 justify-start text-left"
        @click="startRename"
      >
        <span class="min-w-0 truncate">{{
          title || t('agent.newChatTitle')
        }}</span>
      </Button>
      <DropdownMenuRoot v-if="sessionId">
        <DropdownMenuTrigger as-child>
          <Tooltip
            :config="buildTooltipConfig(t('agent.chatOptions'))"
            side="bottom"
          >
            <Button
              variant="muted-textonly"
              size="icon-sm"
              :aria-label="t('agent.chatOptions')"
              class="size-6 shrink-0"
            >
              <span class="icon-[lucide--chevron-down] size-3" />
            </Button>
          </Tooltip>
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
              @select="emit('delete')"
            >
              <span class="icon-[lucide--trash-2] size-4 shrink-0" />
              <span class="truncate">{{ t('g.delete') }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
  </div>
</template>
