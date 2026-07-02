<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ref, watch } from 'vue'

import type { ToolCall } from '@/platform/agent/composables/useAgentChatPrototype'

const { toolCalls, complete = false } = defineProps<{
  toolCalls: readonly ToolCall[]
  complete?: boolean
}>()

const expanded = ref(!complete)
const shouldAnimate = ref(!complete)
const totalDurationMs = toolCalls.reduce((sum, c) => sum + c.durationMs, 0)

watch(
  () => complete,
  (done) => {
    if (done)
      setTimeout(() => {
        expanded.value = false
        shouldAnimate.value = false
      }, 1200)
  }
)

function formatDuration(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<template>
  <div class="flex flex-col">
    <button
      type="button"
      class="flex h-8 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground"
      @click="expanded = !expanded"
    >
      <i class="icon-[lucide--wrench] size-4 shrink-0" />
      <span class="flex-1">
        {{
          $t('agent.toolCalls.summary', {
            count: toolCalls.length,
            duration: formatDuration(totalDurationMs)
          })
        }}
      </span>
      <i
        :class="
          expanded ? 'icon-[lucide--chevron-up]' : 'icon-[lucide--chevron-down]'
        "
        class="size-4 shrink-0"
      />
    </button>

    <Transition
      enter-active-class="transition-opacity duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <ul v-if="expanded" class="flex list-none flex-col pl-0">
        <li
          v-for="(call, i) in toolCalls"
          :key="i"
          :class="
            cn(
              'relative pl-6',
              shouldAnimate &&
                'animate-in fade-in-0 fill-mode-both slide-in-from-top-1'
            )
          "
          :style="
            shouldAnimate
              ? { animationDelay: `${i * 80}ms`, animationDuration: '200ms' }
              : {}
          "
        >
          <div class="absolute inset-y-0 left-4 w-px bg-border-default" />
          <div class="flex h-8 items-center gap-2 rounded-md px-2">
            <i
              :class="
                call.status === 'success'
                  ? 'icon-[lucide--circle-check] text-muted-foreground'
                  : 'icon-[lucide--circle-x] text-muted-foreground/50'
              "
              class="size-4 shrink-0"
            />
            <span class="flex-1 truncate text-sm text-muted-foreground">{{
              call.name
            }}</span>
            <span class="text-sm text-muted-foreground/60 tabular-nums">{{
              formatDuration(call.durationMs)
            }}</span>
          </div>
        </li>
      </ul>
    </Transition>
  </div>
</template>
