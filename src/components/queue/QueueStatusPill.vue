<template>
  <div class="relative isolate">
    <span
      v-for="depth in PEEK_MAX"
      :key="depth"
      :class="cn(PEEK_BASE, depth <= stack ? PEEK_DEPTH[depth] : PEEK_HIDDEN)"
      data-testid="queue-status-peek"
      aria-hidden
    />
    <div
      class="relative z-2 flex h-9 overflow-hidden rounded-lg border border-foreground/10 bg-background shadow-md"
    >
      <Button
        variant="base"
        size="unset"
        :aria-expanded="terminalKind ? undefined : expanded"
        :aria-label="terminalKind ? undefined : accessibleName"
        data-testid="queue-status-toast"
        :class="
          cn(
            'relative h-full items-center justify-start gap-2 rounded-none bg-transparent p-0 text-left font-normal hover:bg-secondary',
            terminalKind ? (thumbSrc ? 'pr-3 pl-1' : 'px-3') : 'pr-2.5 pl-2.5'
          )
        "
        @click="emit('activate')"
      >
        <img
          v-if="terminalKind && thumbSrc"
          :src="thumbSrc"
          alt=""
          class="size-7 shrink-0 rounded-md object-cover"
          data-testid="queue-status-thumb"
        />
        <span
          v-else
          class="relative flex size-4 shrink-0 items-center justify-center"
        >
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
          class="shrink-0 rounded-full bg-foreground/8 px-2 py-0.5 text-xs/4 font-medium text-muted-foreground"
        >
          {{ badge }}
        </span>

        <i
          v-if="!terminalKind"
          :class="
            cn(
              'icon-[lucide--chevron-down] size-3.5 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-180'
            )
          "
          data-testid="queue-status-chevron"
          aria-hidden
        />

        <div
          v-if="progress !== undefined"
          class="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-foreground/70 transition-[width] duration-200 ease-out"
          :style="{ width: `${progress}%` }"
          data-testid="queue-status-progress"
          aria-hidden
        />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
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
  thumbSrc,
  stack = 0
} = defineProps<{
  label: string
  badge?: string
  /** Percent for the hairline under the pill; omitted while terminal. */
  progress?: number
  expanded?: boolean
  /** Set once the queue drains; null while work is active. */
  terminalKind?: TerminalKind | null
  /** The finished result, shown on the Completed chip. */
  thumbSrc?: string
  /** Cards peeking out under the chip while the list is folded. */
  stack?: number
}>()

const PEEK_BASE =
  'pointer-events-none absolute inset-x-0 top-0 h-9 rounded-lg bg-secondary shadow-md transition-[translate,scale,opacity] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none'
const PEEK_MAX = 2
const PEEK_DEPTH: Record<number, string> = {
  1: 'z-1 translate-y-[8px] scale-x-[0.94]',
  2: 'z-0 translate-y-[15px] scale-x-[0.88] opacity-60'
}
/** Slides back under the chip instead of vanishing when the list fans out. */
const PEEK_HIDDEN = 'z-0 translate-y-0 scale-x-100 opacity-0'

const emit = defineEmits<{ activate: [] }>()

const { t } = useI18n()

const accessibleName = computed(
  () =>
    `${label}, ${expanded ? t('queueStatus.hideRuns') : t('queueStatus.showRuns')}`
)

const TERMINAL_ICON: Record<TerminalKind, string> = {
  completed: 'icon-[lucide--check] text-foreground',
  cancelled: 'icon-[lucide--circle-slash] text-muted-foreground',
  failed: 'icon-[lucide--circle-alert] text-destructive'
}
</script>
