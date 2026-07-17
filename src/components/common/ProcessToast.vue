<template>
  <div class="flex select-none flex-col items-stretch">
    <!-- Collapsed pill -->
    <div
      data-testid="process-toast-pill"
      :class="
        cn(
          'relative flex h-8 items-center gap-1.5 overflow-clip rounded-lg bg-comfy-menu-bg py-1 pr-1 pl-2.5 shadow-interface',
          pillClass
        )
      "
    >
      <!-- Status icon -->
      <Loader
        v-if="status === 'progress'"
        size="sm"
        variant="loader-circle"
        class="shrink-0 text-text-secondary"
      />
      <i
        v-else-if="status === 'done'"
        class="icon-[lucide--circle-check] size-4 shrink-0 text-success-background"
      />
      <i
        v-else
        class="icon-[lucide--circle-alert] size-4 shrink-0 text-destructive-background"
      />

      <span class="text-sm font-medium whitespace-nowrap text-base-foreground">
        {{ verb }}
      </span>
      <span
        v-if="showPercent"
        class="text-sm font-medium tabular-nums text-base-foreground"
      >
        {{ displayPercent }}%
      </span>

      <StatusBadge
        v-if="failedCount && failedCount > 0"
        severity="danger"
        :label="t('processToast.failedCount', { count: failedCount })"
        class="ml-0.5 shrink-0"
      />

      <!-- Expand / collapse (hidden when the consumer renders its own) -->
      <Button
        v-if="!hideChevron"
        v-tooltip.bottom="expandTooltip"
        variant="textonly"
        size="icon-sm"
        :aria-label="
          expanded ? t('processToast.collapse') : t('processToast.expand')
        "
        data-testid="process-toast-expand"
        @click="$emit('toggleExpand')"
      >
        <i
          :class="
            cn(
              'size-3.5',
              expanded
                ? 'icon-[lucide--chevron-up]'
                : 'icon-[lucide--chevron-down]'
            )
          "
        />
      </Button>

      <!-- Trailing action: default close (x); override via #action -->
      <slot name="action">
        <Button
          variant="textonly"
          size="icon-sm"
          :aria-label="t('g.close')"
          data-testid="process-toast-close"
          @click="$emit('close')"
        >
          <i class="icon-[lucide--x] size-3.5" />
        </Button>
      </slot>

      <!-- Progress bar hugging the bottom edge -->
      <div
        v-if="showPercent"
        data-testid="process-toast-progress"
        :class="
          cn(
            'absolute -bottom-px -left-px h-0.5 rounded-r-full transition-[width] duration-200 ease-out',
            progressClass
          )
        "
        :style="{ width: `${displayPercent}%` }"
      />
    </div>

    <!-- Expanded details panel -->
    <slot v-if="expanded" name="panel" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { clampPercentInt } from '@/utils/numberUtil'
import { cn } from '@comfyorg/tailwind-utils'

type ProcessToastStatus = 'progress' | 'done' | 'failed'

const {
  verb,
  percent = null,
  status = 'progress',
  failedCount = 0,
  expanded = false,
  hideChevron = false,
  progressClass = 'bg-primary-background',
  pillClass
} = defineProps<{
  /** Status verb, e.g. "Running", "Downloading", "Completed", "Failed". */
  verb: string
  /** Progress 0-100. Null/undefined renders as indeterminate (no percent, no bar). */
  percent?: number | null
  /** Drives the leading icon and progress affordances. */
  status?: ProcessToastStatus
  /** Count of failed jobs alongside active work; shows a danger badge when > 0. */
  failedCount?: number
  expanded?: boolean
  /** Hide the built-in expand chevron (e.g. when the consumer renders its own in #action). */
  hideChevron?: boolean
  /** Tailwind bg class for the progress bar. */
  progressClass?: string
  pillClass?: string
}>()

defineEmits<{
  (e: 'toggleExpand'): void
  (e: 'close'): void
}>()

const { t } = useI18n()

const showPercent = computed(
  () => status === 'progress' && percent != null
)
const displayPercent = computed(() => clampPercentInt(Math.round(percent ?? 0)))

const expandTooltip = computed(() =>
  buildTooltipConfig(
    expanded ? t('processToast.collapse') : t('processToast.expand')
  )
)
</script>
