<template>
  <div class="relative isolate flex items-center">
    <span
      v-for="depth in PEEK_MAX"
      :key="depth"
      :class="cn(PEEK_BASE, depth <= stack ? PEEK_DEPTH[depth] : PEEK_HIDDEN)"
      aria-hidden
    />
    <Button
      variant="base"
      size="unset"
      :aria-expanded="terminalKind ? undefined : expanded"
      data-testid="queue-status-toast"
      :class="
        cn(
          'relative z-2 h-9 items-stretch justify-start overflow-hidden rounded-lg border border-solid border-foreground/9 p-0 text-left font-normal shadow-md',
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
            class="inline-block size-[15px] animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/80"
            data-testid="queue-status-spinner"
            aria-hidden
          />
          <i
            v-else
            :class="cn('size-4', TERMINAL_ICON[terminalKind])"
            aria-hidden
          />
        </span>

        <span
          class="truncate text-sm/5 font-normal whitespace-nowrap text-foreground tabular-nums"
          aria-live="polite"
        >
          {{ label }}
        </span>

        <span
          v-if="badge"
          class="shrink-0 rounded-full bg-foreground/8 px-2 py-1 text-xs/4 font-medium text-muted-foreground"
        >
          {{ badge }}
        </span>

        <div
          v-if="progress !== undefined"
          class="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-foreground/70 transition-[width] duration-200 ease-out"
          :style="{ width: `${progress}%` }"
          data-testid="queue-status-progress"
          aria-hidden
        />
      </div>
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

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

const PEEK_BASE =
  'pointer-events-none absolute inset-x-0 top-0 h-9 rounded-lg border border-foreground/12 bg-background shadow-md transition-[translate,scale,opacity] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]'
const PEEK_MAX = 2
const PEEK_DEPTH: Record<number, string> = {
  1: 'z-1 translate-y-[10px] scale-[0.95]',
  2: 'z-0 translate-y-[19px] scale-[0.9] opacity-85'
}
/** Slides back under the pill instead of vanishing when the deck fans out. */
const PEEK_HIDDEN = 'z-0 translate-y-0 scale-100 opacity-0'

const TERMINAL_ICON: Record<TerminalKind, string> = {
  completed: 'icon-[lucide--check] text-foreground',
  cancelled: 'icon-[lucide--circle-slash] text-muted-foreground',
  failed: 'icon-[lucide--circle-alert] text-destructive'
}
</script>
