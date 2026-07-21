<script setup lang="ts">
import { computed } from 'vue'

import type {
  AssistantMessage,
  NoticePart,
  TextPart,
  ToolPart
} from '../../../services/agent/agentMessageParts'
import { cn } from '@comfyorg/tailwind-utils'

import MarkdownStream from './MarkdownStream.vue'
import MessageFeedback from './MessageFeedback.vue'
import ToolCallGroup from './ToolCallGroup.vue'

const { message } = defineProps<{ message: AssistantMessage }>()
const emit = defineEmits<{ feedback: [vote: 'up' | 'down' | null] }>()

type Group =
  | { kind: 'text'; part: TextPart }
  | { kind: 'notice'; part: NoticePart }
  | { kind: 'tools'; parts: ToolPart[] }

const groups = computed<Group[]>(() => {
  const out: Group[] = []
  for (const part of message.parts) {
    const prev = out.at(-1)
    if (part.type === 'tool') {
      if (prev?.kind === 'tools') prev.parts.push(part)
      else out.push({ kind: 'tools', parts: [part] })
    } else if (part.type === 'text') {
      out.push({ kind: 'text', part })
    } else {
      out.push({ kind: 'notice', part })
    }
  }
  return out
})

const markdown = computed(() =>
  message.parts
    .filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
)

const showActions = computed(
  () => !message.streaming && markdown.value.length > 0
)
</script>

<template>
  <div class="space-y-1.5">
    <div
      v-if="message.thinking || (message.streaming && !message.parts.length)"
      class="text-agent-fg-muted flex items-center gap-1.5 py-1 text-sm"
    >
      <span class="icon-[lucide--brain] size-3.5 shrink-0" />
      <span class="agent-shimmer-text min-w-0 truncate">{{
        message.thinkingText || $t('agent.thinking')
      }}</span>
    </div>

    <template v-for="(group, index) in groups" :key="index">
      <MarkdownStream v-if="group.kind === 'text'" :text="group.part.text" />
      <ToolCallGroup
        v-else-if="group.kind === 'tools'"
        :tools="group.parts"
        :streaming="message.streaming"
      />
      <div
        v-else
        :class="
          cn(
            'rounded-agent flex items-start gap-2 border px-3 py-2 text-sm',
            group.part.level === 'error'
              ? 'border-agent-danger/40 text-agent-danger'
              : 'border-agent-border text-agent-fg-muted'
          )
        "
      >
        <span class="mt-0.5 icon-[lucide--triangle-alert] size-4 shrink-0" />
        <span>{{ group.part.text }}</span>
      </div>
    </template>

    <MessageFeedback
      v-if="showActions"
      :markdown
      @feedback="emit('feedback', $event)"
    />
  </div>
</template>
