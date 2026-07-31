<script setup lang="ts">
import { computed } from 'vue'

import type {
  AssistantMessage,
  NoticePart,
  TabLinkPart,
  TextPart,
  ToolPart
} from '../../../services/agent/agentMessageParts'
import { cn } from '@comfyorg/tailwind-utils'

import MarkdownStream from './MarkdownStream.vue'
import MessageFeedback from './MessageFeedback.vue'
import TabLinkCard from './TabLinkCard.vue'
import ToolCallGroup from './ToolCallGroup.vue'

const { message } = defineProps<{ message: AssistantMessage }>()
const emit = defineEmits<{ feedback: [vote: 'up' | 'down' | null] }>()

type Group =
  | { kind: 'text'; part: TextPart }
  | { kind: 'notice'; part: NoticePart }
  | { kind: 'tools'; parts: ToolPart[] }
  | { kind: 'tabLinks'; parts: TabLinkPart[] }

const groups = computed<Group[]>(() => {
  const out: Group[] = []
  for (const part of message.parts) {
    const prev = out.at(-1)
    if (part.type === 'tool') {
      if (prev?.kind === 'tools') prev.parts.push(part)
      else out.push({ kind: 'tools', parts: [part] })
    } else if (part.type === 'text') {
      out.push({ kind: 'text', part })
    } else if (part.type === 'tabLink') {
      if (prev?.kind === 'tabLinks') prev.parts.push(part)
      else out.push({ kind: 'tabLinks', parts: [part] })
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
  <div class="space-y-4">
    <template v-for="(group, index) in groups" :key="index">
      <MarkdownStream v-if="group.kind === 'text'" :text="group.part.text" />
      <ToolCallGroup
        v-else-if="group.kind === 'tools'"
        :tools="group.parts"
        :streaming="
          message.streaming && !message.thinking && index === groups.length - 1
        "
        :active="
          message.streaming && !message.thinking && index === groups.length - 1
        "
      />
      <div v-else-if="group.kind === 'tabLinks'" class="flex flex-col gap-1">
        <TabLinkCard
          v-for="(link, linkIndex) in group.parts"
          :key="linkIndex"
          :workflow-id="link.workflowId"
          :name="link.name"
        />
      </div>
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

    <div
      v-if="message.thinking || (message.streaming && !message.parts.length)"
      class="text-agent-fg-muted flex h-8 items-center gap-2 rounded-lg px-2 text-sm leading-none font-normal"
    >
      <span class="icon-[lucide--brain] size-4 shrink-0" />
      <span class="agent-shimmer-text min-w-0 truncate">{{
        message.thinkingText || $t('agent.thinking')
      }}</span>
    </div>

    <MessageFeedback
      v-if="showActions"
      class="-mt-1"
      :markdown
      @feedback="emit('feedback', $event)"
    />
  </div>
</template>
