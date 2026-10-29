<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

export type PromptQueueRowStatus = 'running' | 'waiting'

export type PromptQueueRow = {
  id: string
  text: string
  status: PromptQueueRowStatus
}

const { items, expanded = true } = defineProps<{
  items: readonly PromptQueueRow[]
  expanded?: boolean
}>()

const emit = defineEmits<{
  toggle: []
  edit: [id: string]
  delete: [id: string]
}>()

const { t } = useI18n()

function statusIcon(status: PromptQueueRowStatus): string {
  if (status === 'running') return 'icon-[lucide--loader-circle] animate-spin'
  return 'icon-[lucide--circle]'
}
</script>

<template>
  <div
    v-if="items.length > 0"
    data-testid="agent-prompt-queue"
    class="flex flex-col"
  >
    <button
      type="button"
      class="flex h-7 w-full items-center gap-2 rounded-t-lg px-2 text-xs text-foreground hover:bg-accent"
      :aria-expanded="expanded"
      :aria-label="
        expanded ? t('agent.queue.collapse') : t('agent.queue.expand')
      "
      @click="emit('toggle')"
    >
      <i aria-hidden="true" class="icon-[lucide--list] size-3.5" />
      <span class="min-w-0 flex-1 truncate text-left">
        {{ t('agent.queue.queued', { count: items.length }) }}
      </span>
      <i
        aria-hidden="true"
        :class="
          cn(
            'size-3.5',
            expanded
              ? 'icon-[lucide--chevron-down]'
              : 'icon-[lucide--chevron-up]'
          )
        "
      />
    </button>
    <ul v-if="expanded" class="flex flex-col">
      <li
        v-for="item in items"
        :key="item.id"
        :data-status="item.status"
        class="flex h-7 items-center gap-2 px-2"
      >
        <i
          aria-hidden="true"
          :class="cn('size-3.5 text-muted-foreground', statusIcon(item.status))"
        />
        <span
          :class="
            cn(
              'min-w-0 flex-1 truncate text-xs text-muted-foreground',
              item.status === 'running' && 'agent-shimmer-text'
            )
          "
        >
          {{ item.text.trim() }}
        </span>
        <Button
          type="button"
          variant="muted-textonly"
          size="icon-sm"
          :tooltip="t('agent.queue.edit')"
          :aria-label="t('agent.queue.edit')"
          :disabled="item.status === 'running'"
          @click="emit('edit', item.id)"
        >
          <i aria-hidden="true" class="icon-[lucide--pencil] size-3.5" />
        </Button>
        <Button
          type="button"
          variant="muted-textonly"
          size="icon-sm"
          :tooltip="t('agent.queue.delete')"
          :aria-label="t('agent.queue.delete')"
          :disabled="item.status === 'running'"
          @click="emit('delete', item.id)"
        >
          <i aria-hidden="true" class="icon-[lucide--trash-2] size-3.5" />
        </Button>
      </li>
    </ul>
  </div>
</template>
