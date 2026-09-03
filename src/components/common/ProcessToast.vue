<template>
  <div class="flex select-none flex-col items-end">
    <!-- Collapsed pill: a light chip riding on a darker slab that peeks out
         on the right to hold the chevron. Terminal states drop the slab. -->
    <div
      data-testid="process-toast-pill"
      :class="
        cn(
          'relative isolate flex items-center overflow-clip rounded-lg',
          pillClass
        )
      "
    >
      <!-- Every in-progress state holds one width so the run bar doesn't
           breathe as the job moves through them. Terminal states are the
           exception: the work is over, so the pill shrinks to its message. -->
      <component
        :is="interactive ? 'button' : 'div'"
        :type="interactive ? 'button' : undefined"
        :class="
          cn(
            'z-2 flex h-9 items-center gap-2 overflow-clip rounded-lg border-none bg-[#232426] py-1 text-left',
            hasSlab ? '-mr-2 pr-3 pl-2' : 'px-3',
            !isTerminal && chipWidthClass,
            interactive &&
              'cursor-pointer transition-colors hover:bg-secondary-background-hover'
          )
        "
        @click="interactive && $emit('activate')"
      >
        <!-- Completed swaps the status icon for the output thumbnail, so the
             result the run produced is what you see and click into. -->
        <img
          v-if="thumbnailUrl"
          :src="thumbnailUrl"
          alt=""
          class="size-6 shrink-0 rounded-md object-cover outline-1 outline-base-foreground/10"
        />
        <div
          v-else-if="showThumbnailPlaceholder"
          class="flex size-6 shrink-0 items-center justify-center rounded-md bg-base-foreground/10"
          aria-hidden="true"
        >
          <i class="icon-[lucide--file] size-3.5 text-muted-foreground" />
        </div>

        <div class="flex min-w-0 flex-1 items-center gap-1.5">
          <!-- Status icon. All three stay mounted and cross-fade, so the swap
               animates in both directions without a motion library. Hidden
               when a thumbnail takes the lead. -->
          <div v-if="!thumbnailUrl && !showThumbnailPlaceholder" class="relative size-4 shrink-0">
            <div
              :class="
                cn(
                  ICON_TRANSITION,
                  status === 'progress' ? ICON_SHOWN : ICON_HIDDEN
                )
              "
            >
              <Loader
                size="sm"
                variant="loader-circle"
                class="text-base-foreground"
              />
            </div>
            <i
              :class="
                cn(
                  ICON_TRANSITION,
                  'icon-[lucide--circle-check] size-4 text-success-background',
                  status === 'done' ? ICON_SHOWN : ICON_HIDDEN
                )
              "
            />
            <i
              :class="
                cn(
                  ICON_TRANSITION,
                  'icon-[lucide--circle-alert] size-4 text-destructive-background',
                  status === 'failed' ? ICON_SHOWN : ICON_HIDDEN
                )
              "
            />
          </div>

          <!-- Verb and percent read as one sentence, so they share a run -->
          <span
            class="truncate text-sm leading-5 font-normal tabular-nums whitespace-nowrap text-base-foreground"
          >
            {{ label }}
          </span>

          <Transition v-bind="POP_TRANSITION">
            <StatusBadge
              v-if="failedCount && failedCount > 0"
              severity="danger"
              :label="t('processToast.failedCount', { count: failedCount })"
              class="h-3.5 shrink-0 px-1 text-[9px] font-semibold"
            />
          </Transition>
        </div>

        <Transition v-bind="POP_TRANSITION">
          <div v-if="hasAction" class="flex shrink-0 items-center gap-2">
            <div class="h-4 w-px bg-base-foreground/20" aria-hidden="true" />
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
          </div>
        </Transition>
      </component>

      <!-- Chevron slab -->
      <button
        v-if="hasSlab"
        v-tooltip.bottom="expandTooltip"
        type="button"
        class="z-1 flex h-9 w-[41px] cursor-pointer items-center justify-center rounded-r-lg border-none bg-comfy-menu-bg pr-3 pl-4 transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none"
        :aria-label="
          expanded ? t('processToast.collapse') : t('processToast.expand')
        "
        data-testid="process-toast-expand"
        @click="$emit('toggleExpand')"
      >
        <!-- One chevron that rotates, so the flip is interruptible mid-turn -->
        <i
          :class="
            cn(
              'icon-[lucide--chevron-down] size-4 opacity-50 transition-transform duration-200 ease-out motion-reduce:transition-none',
              expanded && 'rotate-180'
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
            'absolute bottom-0 left-0 z-3 h-px rounded-[1px] transition-[width] duration-200 ease-out motion-reduce:transition-none',
            progressClass
          )
        "
        :style="{ width: `${displayPercent}%` }"
      />
    </div>

    <!-- Expanded details panel -->
    <Transition v-bind="PANEL_TRANSITION">
      <slot v-if="expanded" name="panel" />
    </Transition>
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

/**
 * Status icons never unmount; toggling these classes cross-fades them, which
 * animates the exit as well as the enter. The curve stands in for a spring.
 */
const ICON_TRANSITION =
  'absolute inset-0 flex items-center justify-center transition-[opacity,scale,filter] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none'
const ICON_SHOWN = 'scale-100 opacity-100 blur-0'
const ICON_HIDDEN = 'scale-[0.25] opacity-0 blur-[4px]'

/** Affordances that come and go inside the pill. */
const POP_TRANSITION = {
  enterActiveClass:
    'transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none',
  enterFromClass: 'opacity-0 scale-[0.9]',
  enterToClass: 'opacity-100 scale-100',
  leaveActiveClass:
    'transition-[opacity,scale] duration-150 ease-in motion-reduce:transition-none',
  leaveFromClass: 'opacity-100 scale-100',
  leaveToClass: 'opacity-0 scale-[0.9]'
} as const

/** The panel drops out of the pill; the exit stays softer than the enter. */
const PANEL_TRANSITION = {
  enterActiveClass:
    'transition-[opacity,translate,filter] duration-200 ease-out motion-reduce:transition-none',
  enterFromClass: 'opacity-0 -translate-y-2 blur-[4px]',
  enterToClass: 'opacity-100 translate-y-0 blur-0',
  leaveActiveClass:
    'transition-[opacity,translate,filter] duration-150 ease-in motion-reduce:transition-none',
  leaveFromClass: 'opacity-100 translate-y-0 blur-0',
  leaveToClass: 'opacity-0 -translate-y-2 blur-[4px]'
} as const

const {
  verb,
  percent = null,
  status = 'progress',
  failedCount = 0,
  expanded = false,
  hideChevron = false,
  hideAction = false,
  showPercentText = true,
  progressClass = 'bg-base-foreground',
  // Fits the widest in-progress state: "Running 100%" plus a failure badge.
  chipWidthClass = 'min-w-[236px]',
  thumbnailUrl = null,
  showThumbnailPlaceholder = false,
  interactive = false,
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
  /** Keep the progress bar but drop the numeric percent from the label. */
  showPercentText?: boolean
  /**
   * Width held by every in-progress state, so the pill stays put as the job
   * moves between them. Size it to the widest one this instance can show;
   * terminal states ignore it and shrink to their message.
   */
  chipWidthClass?: string
  /** Tailwind bg class for the progress bar. */
  progressClass?: string
  /** Output thumbnail shown in place of the status icon (completed state). */
  thumbnailUrl?: string | null
  /** Show a neutral media tile when the output has no thumbnail (video, audio). */
  showThumbnailPlaceholder?: boolean
  /** Make the chip a button that emits `activate` on click. */
  interactive?: boolean
  pillClass?: string
}>()

defineEmits<{
  (e: 'toggleExpand'): void
  (e: 'close'): void
  (e: 'activate'): void
}>()

const { t } = useI18n()

const showPercent = computed(() => status === 'progress' && percent != null)
const displayPercent = computed(() => clampPercentInt(Math.round(percent ?? 0)))
/** Verb and percent read as one sentence, so they share a single text run. */
const label = computed(() =>
  showPercent.value && showPercentText ? `${verb} ${displayPercent.value}%` : verb
)

/** Terminal states are a bare chip: no slab, no progress. */
const isTerminal = computed(() => status !== 'progress')
// Failed is terminal but still offers a way out (resolve errors), so it keeps
// its trailing action; done and running follow the normal rule.
const hasAction = computed(
  () => !hideAction && (!isTerminal.value || status === 'failed')
)
const hasSlab = computed(() => !isTerminal.value && !hideChevron)

const expandTooltip = computed(() =>
  buildTooltipConfig(
    expanded ? t('processToast.collapse') : t('processToast.expand')
  )
)
</script>
