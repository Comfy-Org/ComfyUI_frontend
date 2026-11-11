<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import ChatList from './ChatList.vue'

import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

const {
  groups,
  loadingId = null,
  failedId = null
} = defineProps<{
  groups: HistoryGroups
  loadingId?: string | null
  failedId?: string | null
}>()
const emit = defineEmits<{
  back: []
  select: [id: string]
  delete: [id: string]
  copyMarkdown: [id: string]
  rename: [id: string, title: string]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex h-10 shrink-0 items-center gap-1 px-2">
      <Button
        :tooltip="t('agent.backToPreviousChat')"
        tooltip-side="bottom"
        type="button"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('agent.backToPreviousChat')"
        class="size-6 shrink-0"
        @click="emit('back')"
      >
        <i aria-hidden="true" class="icon-[lucide--chevron-left]" />
      </Button>
      <h2 class="m-0 text-xs font-normal text-muted-foreground">
        {{ t('agent.history') }}
      </h2>
    </div>

    <ChatList
      :groups
      :loading-id="loadingId"
      :failed-id="failedId"
      @select="emit('select', $event)"
      @delete="emit('delete', $event)"
      @copy-markdown="emit('copyMarkdown', $event)"
      @rename="(id, title) => emit('rename', id, title)"
    />
  </div>
</template>
