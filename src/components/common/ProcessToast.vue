<template>
  <div class="flex select-none flex-col items-end">
    <!-- Collapsed pill: a light chip riding on a darker slab that peeks out
         on the right to hold the chevron. Terminal states drop the slab. -->
    <div
      data-testid="process-toast-pill"
      :class="cn('relative isolate flex items-center rounded-lg', pillClass)"
    >
      <div
        :class="
          cn(
            'z-2 flex h-9 items-center gap-2 overflow-clip rounded-lg bg-[#232426] py-1',
            hasSlab ? '-mr-2 pr-3 pl-2' : 'px-3'
          )
        "
      >
        <div class="flex items-center gap-1.5">
          <!-- Status icon -->
          <Loader
            v-if="status === 'progress'"
            size="sm"
            variant="loader-circle"
            class="shrink-0 text-base-foreground"
          />
          <i
            v-else-if="status === 'done'"
            class="icon-[lucide--circle-check] size-4 shrink-0 text-success-background"
          />
          <i
            v-else
            class="icon-[lucide--circle-alert] size-4 shrink-0 text-destructive-background"
          />

          <!-- Verb and percent read as one sentence, so they share a run -->
          <span
            class="text-sm leading-5 font-medium tabular-nums whitespace-nowrap text-base-foreground"
          >
            {{ label }}
          </span>

          <StatusBadge
            v-if="failedCount && failedCount > 0"
            severity="danger"
            :label="t('processToast.failedCount', { count: failedCount })"
            class="h-3.5 shrink-0 px-1 text-[9px] font-semibold"
          />
        </div>

        <template v-if="hasAction">
          <div class="h-4 w-px shrink-0 bg-base-foreground/20" aria-hidden="true" />
          <!-- Trailing action: default close (x); override via #action. -->
          <slot name="action">
            <Button
              variant="textonly"
              size="icon-sm"
              :aria-label="t('g.close')"
              data-testid="process-toast-close"
              @click="$emit('close')"
            >
              <i class="icon-[lucide--x] size-4" />
            </Button>
          </slot>
        </template>
      </div>

      <!-- Chevron slab -->
      <button
        v-if="hasSlab"
        v-tooltip.bottom="expandTooltip"
        type="button"
        class="z-1 flex h-9 w-[41px] cursor-pointer items-center justify-center rounded-r-lg border-none bg-comfy-menu-bg pr-3 pl-4"
        :aria-label="
          expanded ? t('processToast.collapse') : t('processToast.expand')
        "
        data-testid="process-toast-expand"
        @click="$emit('toggleExpand')"
      >
        <i
          :class="
            cn(
              'size-4 opacity-50',
              expanded
                ? 'icon-[lucide--chevron-up]'
                : 'icon-[lucide--chevron-down]'
            )
          "
        />
      </button>

      <!-- Progress hugs the bottom edge of the whole pill -->
      <div
        v-if="showPercent"
        data-testid="process-toast-progress"
        :class="
          cn(
            'absolute bottom-0 left-0 z-3 h-px rounded-[1px] transition-[width] duration-200 ease-out',
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

import StatusBadge from '@/components/common/StatusBadge.vue'
import Loader from '@/components/loader/Loader.vue'
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
  hideAction = false,
  progressClass = 'bg-base-foreground',
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
  /** Hide the chevron slab (e.g. nothing to expand into). */
  hideChevron?: boolean
  /** Hide the divider and trailing action. */
  hideAction?: boolean
  /** Tailwind bg class for the progress bar. */
  progressClass?: string
  pillClass?: string
}>()

defineEmits<{
  (e: 'toggleExpand'): void
  (e: 'close'): void
}>()

const { t } = useI18n()

const showPercent = computed(() => status === 'progress' && percent != null)
const displayPercent = computed(() => clampPercentInt(Math.round(percent ?? 0)))
/** Verb and percent read as one sentence, so they share a single text run. */
const label = computed(() =>
  showPercent.value ? `${verb} ${displayPercent.value}%` : verb
)

/** Terminal states are a bare chip: no actions, no slab, no progress. */
const isTerminal = computed(() => status !== 'progress')
const hasAction = computed(() => !isTerminal.value && !hideAction)
const hasSlab = computed(() => !isTerminal.value && !hideChevron)

const expandTooltip = computed(() =>
  buildTooltipConfig(
    expanded ? t('processToast.collapse') : t('processToast.expand')
  )
)
</script>
