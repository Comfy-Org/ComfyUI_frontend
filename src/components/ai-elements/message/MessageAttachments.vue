<script setup lang="ts">
import type { MessageAttachment } from '@/platform/agent/composables/useAgentChatPrototype'

const { attachments } = defineProps<{
  attachments: readonly MessageAttachment[]
}>()

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div
      v-for="(attachment, i) in attachments"
      :key="i"
      class="flex items-center gap-3 rounded-lg border border-border-default bg-secondary-background p-2"
    >
      <div
        class="size-10 shrink-0 overflow-hidden rounded-md border border-border-default"
      >
        <img
          v-if="attachment.type.startsWith('image/')"
          :src="attachment.url"
          :alt="attachment.name"
          class="size-full object-cover"
        />
        <div
          v-else
          class="flex size-full items-center justify-center bg-secondary-background-hover"
        >
          <i class="icon-[lucide--file] size-4 text-muted-foreground" />
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <span class="block truncate text-xs font-medium text-base-foreground">
          {{ attachment.name }}
        </span>
        <span class="block text-xs text-muted-foreground">
          {{ formatFileSize(attachment.size) }}
        </span>
      </div>
    </div>
  </div>
</template>
