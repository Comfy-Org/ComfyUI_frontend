<template>
  <div
    class="relative flex h-9 overflow-hidden rounded-lg bg-background shadow-md"
  >
    <Button
      variant="base"
      size="unset"
      :aria-expanded="terminalKind ? undefined : expanded"
      data-testid="queue-status-toast"
      :class="
        cn(
          'relative h-full items-center justify-start gap-2 rounded-none bg-transparent p-0 text-left font-normal hover:bg-secondary',
          terminalKind ? (thumbSrc ? 'pr-3 pl-1' : 'px-3') : 'pr-2 pl-2.5'
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

      <div
        v-if="progress !== undefined"
        class="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-foreground/70 transition-[width] duration-200 ease-out"
        :style="{ width: `${progress}%` }"
        data-testid="queue-status-progress"
        aria-hidden
      />
    </Button>

    <template v-if="!terminalKind">
      <TextTooltip :text="t('queueStatus.cancelAll')" side="bottom">
        <Button
          variant="muted-textonly"
          size="unset"
          class="h-full w-8 rounded-none hover:bg-secondary"
          :aria-label="t('queueStatus.stopAll')"
          data-testid="queue-status-stop"
          @click="emit('stop')"
        >
          <span class="size-2.5 rounded-xs bg-current" aria-hidden />
        </Button>
      </TextTooltip>
      <TextTooltip
        :text="expanded ? t('queueStatus.hideRuns') : t('queueStatus.showRuns')"
        side="bottom"
      >
        <Button
          variant="muted-textonly"
          size="unset"
          class="h-full w-7 rounded-none hover:bg-secondary"
          :aria-label="t('queueStatus.toggleList')"
          :aria-expanded="expanded"
          data-testid="queue-status-chevron"
          @click="emit('activate')"
        >
          <i
            :class="
              cn(
                'icon-[lucide--chevron-down] size-3.5 transition-transform duration-200',
                expanded && 'rotate-180'
              )
            "
            aria-hidden
          />
        </Button>
      </TextTooltip>
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import TextTooltip from '@comfyorg/design-system/tooltip/TextTooltip'
import { cn } from '@comfyorg/tailwind-utils'
import { useI18n } from 'vue-i18n'

import type { TerminalKind } from './queueStatusTypes'

const {
  label,
  badge,
  progress,
  expanded = false,
  terminalKind = null,
  thumbSrc
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
}>()

const emit = defineEmits<{ activate: []; stop: [] }>()

const { t } = useI18n()

const TERMINAL_ICON: Record<TerminalKind, string> = {
  completed: 'icon-[lucide--check] text-foreground',
  cancelled: 'icon-[lucide--circle-slash] text-muted-foreground',
  failed: 'icon-[lucide--circle-alert] text-destructive'
}
</script>
