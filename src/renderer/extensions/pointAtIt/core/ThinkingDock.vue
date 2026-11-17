<template>
  <section
    data-testid="point-at-it-dock"
    :aria-label="messages.thinking"
    class="flex flex-col rounded-lg border border-border bg-background text-xs shadow-md"
  >
    <div class="flex items-center gap-1 border-b border-border px-3 py-1">
      <span class="flex-1 font-medium">{{ messages.thinking }}</span>
      <Button v-if="canCancel" size="sm" @click="emit('cancel')">
        {{ messages.cancel }}
      </Button>
      <Button
        variant="textonly"
        size="icon-sm"
        :aria-label="tall ? messages.thinkingShorter : messages.thinkingTaller"
        @click="emit('taller')"
      >
        <i
          :class="
            cn(
              'size-3',
              tall ? 'icon-[lucide--minimize-2]' : 'icon-[lucide--maximize-2]'
            )
          "
          aria-hidden="true"
        />
      </Button>
      <Button
        variant="textonly"
        size="icon-sm"
        :aria-label="messages.hideThinking"
        @click="emit('collapse')"
      >
        <i class="icon-[lucide--chevron-down] size-3" aria-hidden="true" />
      </Button>
    </div>
    <p
      ref="body"
      role="log"
      tabindex="0"
      :aria-label="messages.thinking"
      :class="
        cn(
          'm-0 overflow-y-auto px-3 py-2 whitespace-pre-wrap text-muted-foreground',
          !tall && 'h-16'
        )
      "
      :style="tall ? { height: `${cap}px` } : undefined"
    >
      {{ text }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import { messages } from './messages'
import type { ThinkingLog } from './thinkingLog'

const { thinking } = defineProps<{
  thinking: ThinkingLog
  tall: boolean
  cap: number
  canCancel: boolean
}>()

const emit = defineEmits<{ collapse: []; taller: []; cancel: [] }>()

const body = useTemplateRef('body')
const text = computed(() => {
  const written = thinking.text.trim()
  if (written) return written
  return thinking.done ? messages.noThinking : messages.askWaiting
})

function scrollToEnd() {
  const element = body.value
  if (element) element.scrollTop = element.scrollHeight
}

onMounted(scrollToEnd)
watch(text, () => nextTick(scrollToEnd))
</script>
