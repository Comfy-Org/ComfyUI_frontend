<template>
  <ol
    ref="list"
    role="log"
    :aria-label="messages.threadLabel"
    class="m-0 flex max-h-48 list-none flex-col gap-2 overflow-y-auto p-0 text-xs"
  >
    <li
      v-for="(message, index) in thread"
      :key="index"
      class="flex flex-col gap-0.5"
    >
      <span class="text-muted-foreground">
        {{
          message.kind === 'answer' ? messages.threadAgent : messages.threadYou
        }}
      </span>
      <template v-if="message.kind === 'answer'">
        <span class="wrap-break-word whitespace-pre-line">
          {{ message.step.text }}
        </span>
        <span v-if="message.step.offerEdit" class="text-muted-foreground">
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
        <span class="wrap-break-word whitespace-pre-line">
          {{ message.text }}
        </span>
        <details
          v-if="message.kind === 'followUp' && message.thinking"
          class="text-muted-foreground"
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
