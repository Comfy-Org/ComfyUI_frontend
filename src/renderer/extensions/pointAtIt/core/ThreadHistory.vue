<template>
  <ol
    ref="list"
    role="log"
    :aria-label="messages.threadLabel"
    class="m-0 flex max-h-64 list-none flex-col gap-3 overflow-y-auto p-0"
  >
    <li
      v-for="(message, index) in thread"
      :key="index"
      :class="
        cn(
          'flex flex-col gap-1',
          message.kind === 'answer' ? 'items-start' : 'items-end'
        )
      "
    >
      <span class="sr-only">
        {{
          message.kind === 'answer' ? messages.threadAgent : messages.threadYou
        }}
      </span>
      <template v-if="message.kind === 'answer'">
        <span class="wrap-break-word whitespace-pre-line">
          {{ message.step.text }}
        </span>
        <span
          v-if="message.step.offerEdit"
          class="text-xs text-muted-foreground"
        >
          {{
            messages.offeredNote(
              message.step.offerEdit.target.setting,
              message.step.offerEdit.value,
              message.step.result
            )
          }}
        </span>
      </template>
      <template v-else>
        <span
          class="max-w-[85%] rounded-lg bg-secondary px-3 py-1.5 wrap-break-word whitespace-pre-line"
        >
          {{ message.text }}
        </span>
        <details
          v-if="message.kind === 'followUp' && message.thinking"
          class="text-xs text-muted-foreground"
        >
          <summary class="cursor-pointer">{{ messages.thinking }}</summary>
          <p
            class="m-0 max-h-24 overflow-y-auto rounded-md bg-secondary p-2 whitespace-pre-wrap"
          >
            {{ message.thinking }}
          </p>
        </details>
      </template>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { messages } from './messages'
import type { ThreadMessage } from './turns'

const { thread } = defineProps<{
  /** What was said before the answer the bubble shows, oldest first. */
  thread: ThreadMessage[]
}>()

const list = useTemplateRef('list')

watch(
  () => thread.length,
  async () => {
    await nextTick()
    if (list.value) list.value.scrollTop = list.value.scrollHeight
  },
  { immediate: true }
)
</script>
