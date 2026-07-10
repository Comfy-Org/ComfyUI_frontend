<script setup lang="ts">
import type { UserAttachment } from '../../../stores/agent/agentConversationStore'

const {
  text,
  attachments = [],
  tags = []
} = defineProps<{
  text: string
  attachments?: UserAttachment[]
  tags?: string[]
}>()
</script>

<template>
  <div class="flex flex-col items-end gap-1.5">
    <div v-if="tags.length" class="flex flex-wrap justify-end gap-1">
      <span
        v-for="(tag, index) in tags"
        :key="`${tag}:${index}`"
        class="rounded-agent bg-agent-pill text-agent-fg-muted inline-flex items-center gap-1 px-1.5 py-0.5 text-xs"
      >
        <span class="icon-[lucide--at-sign] size-3" />
        {{ tag }}
      </span>
    </div>
    <div
      v-if="attachments.length"
      class="grid w-56 max-w-full grid-cols-2 gap-1.5"
    >
      <figure
        v-for="(item, index) in attachments"
        :key="`${item.name}:${index}`"
        class="m-0"
      >
        <img
          v-if="item.previewUrl"
          :src="item.previewUrl"
          :alt="item.name"
          class="aspect-square w-full rounded-lg object-cover"
        />
        <div
          v-else
          class="bg-agent-surface-raised flex aspect-square w-full items-center justify-center rounded-lg"
        >
          <span class="text-agent-fg-subtle icon-[lucide--image] size-6" />
        </div>
        <figcaption class="text-agent-fg-muted mt-0.5 truncate text-xs">
          {{ item.name }}
        </figcaption>
      </figure>
    </div>
    <div
      v-if="text"
      class="bg-agent-surface-raised text-agent-fg w-fit max-w-full rounded-lg px-4 py-3 text-xs whitespace-pre-wrap"
    >
      {{ text }}
    </div>
  </div>
</template>
