<script setup lang="ts">
import { ref, watch } from 'vue'

import type { ToolCall } from '@/platform/agent/composables/useAgentChatPrototype'

const { toolCalls, complete = false } = defineProps<{
  toolCalls: readonly ToolCall[]
  complete?: boolean
}>()

const expanded = ref(true)
const totalDurationMs = toolCalls.reduce((sum, c) => sum + c.durationMs, 0)

watch(
  () => complete,
  (done) => {
    if (done) setTimeout(() => (expanded.value = false), 1200)
  },
  { immediate: true }
)

function formatDuration(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<template>
  <div class="flex flex-col gap-0">
    <button
      type="button"
      class="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left text-xs text-muted-foreground transition-colors hover:text-base-foreground"
      @click="expanded = !expanded"
    >
      <i class="icon-[lucide--wrench] size-3.5 shrink-0" />
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
        class="size-3 shrink-0"
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
      <ul v-if="expanded" class="mt-2 flex list-none flex-col pl-0">
        <li
          v-for="(call, i) in toolCalls"
          :key="i"
          class="flex animate-in gap-2 text-xs fade-in-0 fill-mode-both slide-in-from-top-1"
          :style="{ animationDelay: `${i * 80}ms`, animationDuration: '200ms' }"
        >
          <div class="relative flex flex-col items-center">
            <i
              :class="
                call.status === 'success'
                  ? 'icon-[lucide--circle-check] text-muted-foreground'
                  : 'icon-[lucide--circle-x] text-muted-foreground/50'
              "
              class="mt-0.5 size-3.5 shrink-0"
            />
            <div
              v-if="i < toolCalls.length - 1"
              class="mt-1 w-px flex-1 bg-border-default"
            />
          </div>
          <div class="flex flex-1 items-start justify-between gap-4 pb-2.5">
            <span class="text-muted-foreground">{{ call.name }}</span>
            <span class="text-muted-foreground/60 tabular-nums">{{
              formatDuration(call.durationMs)
            }}</span>
          </div>
        </li>
      </ul>
    </Transition>
  </div>
</template>
