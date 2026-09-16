<template>
  <div class="relative isolate flex items-center">
    <span
      v-for="depth in stack"
      :key="depth"
      :class="cn(PEEK_BASE, PEEK_DEPTH[depth] ?? PEEK_DEPTH[2])"
      aria-hidden
    />
    <button
      type="button"
      :aria-expanded="terminalKind ? undefined : expanded"
      :aria-label="ariaLabel"
      data-testid="queue-status-toast"
      :class="
        cn(
          'relative z-2 flex h-9 cursor-pointer items-stretch overflow-hidden rounded-[10px] border border-base-foreground/9 bg-base-background/80 p-0 text-left shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-colors hover:bg-secondary-background/80',
          terminalKind ? 'items-center px-3' : 'min-w-[176px]'
        )
      "
      @click="emit('activate')"
    >
      <div
        :class="
          cn(
            'relative flex min-w-0 flex-1 items-center gap-2',
            !terminalKind && 'pr-2 pl-2.5'
          )
        "
      >
        <span class="relative flex size-4 shrink-0 items-center justify-center">
          <span
            v-if="!terminalKind"
            class="inline-block size-[15px] animate-spin rounded-full border-2 border-base-foreground/20 border-t-base-foreground/80"
            aria-hidden
          />
          <i
            v-else
            :class="cn('size-4', TERMINAL_ICON[terminalKind])"
            aria-hidden
          />
        </span>

        <span
          class="truncate text-[13.5px] leading-none font-normal whitespace-nowrap text-base-foreground tabular-nums"
        >
          {{ label }}
        </span>

        <span
          v-if="badge"
          class="shrink-0 rounded-full bg-white/8 px-1.5 py-1 text-[10px] leading-none font-medium tracking-wide text-muted-foreground uppercase"
        >
          {{ badge }}
        </span>

        <div
          v-if="progress !== undefined"
          class="pointer-events-none absolute bottom-0 left-0 h-px bg-base-foreground/70 transition-[width] duration-200 ease-out"
          :style="{ width: `${progress}%` }"
          aria-hidden
        />
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { TerminalKind } from './queueStatusTypes'

const {
  label,
  badge,
  progress,
  expanded = false,
  terminalKind = null,
  stack = 0
} = defineProps<{
  label: string
  badge?: string
  /** Percent for the hairline under the pill; omitted while terminal. */
  progress?: number
  expanded?: boolean
  /** Set once the queue drains; null while work is active. */
  terminalKind?: TerminalKind | null
  /** Cards peeking out under the pill while the deck is collapsed. */
  stack?: number
}>()

const emit = defineEmits<{ activate: [] }>()

const { t } = useI18n()

const PEEK_BASE =
  'pointer-events-none absolute inset-x-0 top-0 h-9 rounded-[10px] border border-base-foreground/9 bg-base-background/75 backdrop-blur-xl transition-all duration-200 ease-out'
const PEEK_DEPTH: Record<number, string> = {
  1: 'z-1 translate-y-[6px] scale-[0.97] opacity-90',
  2: 'z-0 translate-y-[12px] scale-[0.94] opacity-70'
}

const TERMINAL_ICON: Record<TerminalKind, string> = {
  completed: 'icon-[lucide--check] text-base-foreground',
  cancelled: 'icon-[lucide--circle-slash] text-muted-foreground',
  failed: 'icon-[lucide--circle-alert] text-destructive-background'
}

const ariaLabel = computed(() => {
  if (!terminalKind) return t('queueStatus.activeGenerations')
  return terminalKind === 'completed' ? t('queueStatus.viewResults') : undefined
})
</script>
