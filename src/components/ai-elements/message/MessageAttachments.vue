<script setup lang="ts">
import type { MessageAttachment } from '@/platform/agent/composables/useAgentChatPrototype'

const { attachments } = defineProps<{
  attachments: readonly MessageAttachment[]
}>()
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <div v-for="(attachment, i) in attachments" :key="i">
      <img
        v-if="attachment.type.startsWith('image/')"
        :src="attachment.url"
        :alt="attachment.name"
        class="max-h-48 max-w-xs rounded-lg object-cover"
      />
      <div
        v-else
        class="flex h-10 w-44 items-center gap-2 rounded-lg border border-border-default bg-secondary-background-hover px-3"
      >
        <i class="icon-[lucide--file] size-4 shrink-0 text-muted-foreground" />
        <span class="truncate text-xs text-base-foreground">{{
          attachment.name
        }}</span>
      </div>
    </div>
  </div>
</template>
