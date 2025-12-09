<template>
  <div
    ref="rowRef"
    class="relative"
    data-testid="queue-job-item"
    :data-job-id="props.jobId"
    :data-job-state="props.state"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @contextmenu.stop.prevent="onContextMenu"
  >
    <Teleport to="body">
      <div
        v-if="!isPreviewVisible && showDetails && popoverPosition"
        class="fixed z-50"
        :style="{
          top: `${popoverPosition.top}px`,
          right: `${popoverPosition.right}px`
        }"
        @mouseenter="onPopoverEnter"
        @mouseleave="onPopoverLeave"
      >
        <JobDetailsPopover
          :job-id="props.jobId"
          :workflow-id="props.workflowId"
        />
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="isPreviewVisible && canShowPreview && popoverPosition"
        class="fixed z-50"
        :style="{
          top: `${popoverPosition.top}px`,
          right: `${popoverPosition.right}px`
        }"
        @mouseenter="onPreviewEnter"
        @mouseleave="onPreviewLeave"
      >
        <QueueAssetPreview
          :image-url="iconImageUrl!"
          :name="props.title"
          :time-label="rightText || undefined"
          @image-click="emit('view')"
        />
      </div>
    </Teleport>

    <div class="flex items-center gap-1">
      <div
        class="relative flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg border border-secondary-background bg-secondary-background p-1 text-[12px] text-text-primary transition-colors duration-150 ease-in-out hover:border-secondary-background-hover hover:bg-secondary-background-hover"
      >
        <div
          v-if="
            props.state === 'running' &&
            (props.progressTotalPercent !== undefined ||
              props.progressCurrentPercent !== undefined)
          "
          class="absolute inset-0"
        >
          <div
            v-if="props.progressTotalPercent !== undefined"
            class="pointer-events-none absolute inset-y-0 left-0 h-full bg-interface-panel-job-progress-primary transition-[width]"
            :style="{ width: `${props.progressTotalPercent}%` }"
          />
          <div
            v-if="props.progressCurrentPercent !== undefined"
            class="pointer-events-none absolute inset-y-0 left-0 h-full bg-interface-panel-job-progress-secondary transition-[width]"
            :style="{ width: `${props.progressCurrentPercent}%` }"
          />
        </div>

        <div class="relative z-[1] flex items-center gap-1">
          <div class="relative inline-flex items-center justify-center">
            <div
              class="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2"
              @mouseenter.stop="onIconEnter"
              @mouseleave.stop="onIconLeave"
            />
            <div
              class="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-[6px]"
            >
              <img
                v-if="iconImageUrl"
                :src="iconImageUrl"
                class="h-full w-full object-cover"
              />
              <i
                v-else
                :class="cn(iconClass, 'size-4', shouldSpin && 'animate-spin')"
              />
            </div>
          </div>
        </div>

        <div class="relative z-[1] min-w-0 flex-1">
          <div class="truncate opacity-90" :title="props.title">
            <slot name="primary">{{ props.title }}</slot>
          </div>
        </div>

        <div class="relative z-[1] shrink-0 pr-2 text-text-secondary">
          <slot name="secondary">{{ props.rightText }}</slot>
        </div>
      </div>

      <div
        v-if="hoverActions.length || alwaysActions.length"
        class="relative z-[1] flex items-center gap-1 text-text-secondary"
      >
        <div
          v-if="isHovered && hoverActions.length"
          class="flex items-center gap-1"
        >
          <template v-for="action in hoverActions" :key="action.key">
            <IconButton
              v-if="action.type === 'icon'"
              v-tooltip.top="action.tooltip"
              :type="action.buttonType"
              size="sm"
              :class="actionButtonClass"
              :aria-label="action.ariaLabel"
              :data-testid="`job-action-${action.key}`"
              @click.stop="action.onClick?.($event)"
            >
              <i :class="cn(action.iconClass, 'size-4')" />
            </IconButton>
            <TextButton
              v-else
              class="h-8 gap-1 rounded-lg bg-modal-card-button-surface px-3 py-0 text-text-primary transition duration-150 ease-in-out hover:opacity-95"
              type="transparent"
              :label="action.label"
              :aria-label="action.ariaLabel"
              :data-testid="`job-action-${action.key}`"
              @click.stop="action.onClick?.($event)"
            />
          </template>
        </div>

        <div v-if="alwaysActions.length" class="flex items-center gap-1">
          <template v-for="action in alwaysActions" :key="action.key">
            <IconButton
              v-if="action.type === 'icon'"
              v-tooltip.top="action.tooltip"
              :type="action.buttonType"
              size="sm"
              :class="actionButtonClass"
              :aria-label="action.ariaLabel"
              :data-testid="`job-action-${action.key}`"
              @click.stop="action.onClick?.($event)"
            >
              <i :class="cn(action.iconClass, 'size-4')" />
            </IconButton>
            <TextButton
              v-else
              class="h-8 gap-1 rounded-lg bg-modal-card-button-surface px-3 py-0 text-text-primary transition duration-150 ease-in-out hover:opacity-95"
              type="transparent"
              :label="action.label"
              :aria-label="action.ariaLabel"
              :data-testid="`job-action-${action.key}`"
              @click.stop="action.onClick?.($event)"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import IconButton from '@/components/button/IconButton.vue'
import TextButton from '@/components/button/TextButton.vue'
import JobDetailsPopover from '@/components/queue/job/JobDetailsPopover.vue'
import QueueAssetPreview from '@/components/queue/job/QueueAssetPreview.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import type { JobState } from '@/types/queue'
import { iconForJobState } from '@/utils/queueDisplay'
import { cn } from '@/utils/tailwindUtil'

const props = withDefaults(
  defineProps<{
    jobId: string
    workflowId?: string
    state: JobState
    title: string
    rightText?: string
    iconName?: string
    iconImageUrl?: string
    showClear?: boolean
    showMenu?: boolean
    progressTotalPercent?: number
    progressCurrentPercent?: number
    runningNodeName?: string
    activeDetailsId?: string | null
  }>(),
  {
    workflowId: undefined,
    rightText: '',
    iconName: undefined,
    iconImageUrl: undefined,
    showClear: undefined,
    showMenu: undefined,
    progressTotalPercent: undefined,
    progressCurrentPercent: undefined,
    runningNodeName: undefined,
    activeDetailsId: null
  }
)

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'delete'): void
  (e: 'menu', event: MouseEvent): void
  (e: 'view'): void
  (e: 'details-enter', jobId: string): void
  (e: 'details-leave', jobId: string): void
}>()

const { t } = useI18n()

const cancelTooltipConfig = computed(() => buildTooltipConfig(t('g.cancel')))
const deleteTooltipConfig = computed(() => buildTooltipConfig(t('g.delete')))
const moreTooltipConfig = computed(() => buildTooltipConfig(t('g.more')))
const viewTooltipConfig = computed(() =>
  buildTooltipConfig(t('menuLabels.View'))
)

const rowRef = ref<HTMLDivElement | null>(null)
const showDetails = computed(() => props.activeDetailsId === props.jobId)

const onRowEnter = () => {
  if (!isPreviewVisible.value) emit('details-enter', props.jobId)
}
const onRowLeave = () => emit('details-leave', props.jobId)
const onPopoverEnter = () => emit('details-enter', props.jobId)
const onPopoverLeave = () => emit('details-leave', props.jobId)

const isPreviewVisible = ref(false)
const previewHideTimer = ref<number | null>(null)
const previewShowTimer = ref<number | null>(null)
const clearPreviewHideTimer = () => {
  if (previewHideTimer.value !== null) {
    clearTimeout(previewHideTimer.value)
    previewHideTimer.value = null
  }
}
const clearPreviewShowTimer = () => {
  if (previewShowTimer.value !== null) {
    clearTimeout(previewShowTimer.value)
    previewShowTimer.value = null
  }
}
const canShowPreview = computed(
  () => props.state === 'completed' && !!props.iconImageUrl
)
const scheduleShowPreview = () => {
  if (!canShowPreview.value) return
  clearPreviewHideTimer()
  clearPreviewShowTimer()
  previewShowTimer.value = window.setTimeout(() => {
    isPreviewVisible.value = true
    previewShowTimer.value = null
  }, 200)
}
const scheduleHidePreview = () => {
  clearPreviewHideTimer()
  clearPreviewShowTimer()
  previewHideTimer.value = window.setTimeout(() => {
    isPreviewVisible.value = false
    previewHideTimer.value = null
  }, 150)
}
const onIconEnter = () => scheduleShowPreview()
const onIconLeave = () => scheduleHidePreview()
const onPreviewEnter = () => scheduleShowPreview()
const onPreviewLeave = () => scheduleHidePreview()

const popoverPosition = ref<{ top: number; right: number } | null>(null)

const updatePopoverPosition = () => {
  const el = rowRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const gap = 8
  popoverPosition.value = {
    top: rect.top,
    right: window.innerWidth - rect.left + gap
  }
}

const isAnyPopoverVisible = computed(
  () => showDetails.value || (isPreviewVisible.value && canShowPreview.value)
)

type ActionVariant = 'neutral' | 'destructive'
type ActionMode = 'hover' | 'always'

type BaseActionConfig = {
  key: string
  variant: ActionVariant
  mode: ActionMode
  ariaLabel: string
  tooltip?: ReturnType<typeof buildTooltipConfig>
  isVisible: () => boolean
  onClick?: (event?: MouseEvent) => void
}

type IconActionConfig = BaseActionConfig & {
  type: 'icon'
  iconClass: string
  buttonType: 'secondary' | 'destructive'
}

type TextActionConfig = BaseActionConfig & {
  type: 'text'
  label: string
}

type ActionConfig = IconActionConfig | TextActionConfig

watch(
  isAnyPopoverVisible,
  (visible) => {
    if (visible) {
      nextTick(updatePopoverPosition)
    } else {
      popoverPosition.value = null
    }
  },
  { immediate: false }
)

const isHovered = ref(false)

const computedShowClear = computed(() => {
  if (props.showClear !== undefined) return props.showClear
  return props.state !== 'completed'
})

const baseActions = computed<ActionConfig[]>(() => {
  const showMenu = props.showMenu !== undefined ? props.showMenu : true

  return [
    {
      key: 'menu',
      type: 'icon',
      variant: 'neutral',
      buttonType: 'secondary',
      mode: 'hover',
      iconClass: 'icon-[lucide--more-horizontal]',
      ariaLabel: t('g.more'),
      tooltip: moreTooltipConfig.value,
      isVisible: () => showMenu,
      onClick: (event?: MouseEvent) => {
        if (event) emit('menu', event)
      }
    },
    {
      key: 'delete',
      type: 'icon',
      variant: 'destructive',
      buttonType: 'destructive',
      mode: 'hover',
      iconClass: 'icon-[lucide--trash-2]',
      ariaLabel: t('g.delete'),
      tooltip: deleteTooltipConfig.value,
      isVisible: () => props.state === 'failed' && computedShowClear.value,
      onClick: () => {
        onRowLeave()
        emit('delete')
      }
    },
    {
      key: 'cancel-hover',
      type: 'icon',
      variant: 'destructive',
      buttonType: 'destructive',
      mode: 'hover',
      iconClass: 'icon-[lucide--x]',
      ariaLabel: t('g.cancel'),
      tooltip: cancelTooltipConfig.value,
      isVisible: () =>
        props.state !== 'completed' &&
        props.state !== 'running' &&
        props.state !== 'failed' &&
        computedShowClear.value,
      onClick: () => {
        onRowLeave()
        emit('cancel')
      }
    },
    {
      key: 'view',
      type: 'icon',
      variant: 'neutral',
      buttonType: 'secondary',
      mode: 'hover',
      iconClass: 'icon-[lucide--zoom-in]',
      ariaLabel: t('menuLabels.View'),
      tooltip: viewTooltipConfig.value,
      isVisible: () => props.state === 'completed',
      onClick: () => emit('view')
    },
    {
      key: 'cancel-running',
      type: 'icon',
      variant: 'destructive',
      buttonType: 'destructive',
      mode: 'always',
      iconClass: 'icon-[lucide--x]',
      ariaLabel: t('g.cancel'),
      tooltip: cancelTooltipConfig.value,
      isVisible: () => props.state === 'running' && computedShowClear.value,
      onClick: () => {
        onRowLeave()
        emit('cancel')
      }
    }
  ]
})

const hoverActions = computed(() =>
  baseActions.value.filter(
    (action) => action.mode === 'hover' && action.isVisible()
  )
)

const alwaysActions = computed(() =>
  baseActions.value.filter(
    (action) => action.mode === 'always' && action.isVisible()
  )
)

const handleMouseEnter = () => {
  isHovered.value = true
  onRowEnter()
}

const handleMouseLeave = () => {
  isHovered.value = false
  onRowLeave()
}

const actionButtonClass =
  'h-8 min-w-8 gap-1 rounded-lg text-text-primary transition duration-150 ease-in-out hover:opacity-95'

const iconClass = computed(() => {
  if (props.iconName) return props.iconName
  return iconForJobState(props.state)
})

const shouldSpin = computed(
  () =>
    props.state === 'pending' &&
    iconClass.value === iconForJobState('pending') &&
    !props.iconImageUrl
)

const onContextMenu = (event: MouseEvent) => {
  const shouldShowMenu = props.showMenu !== undefined ? props.showMenu : true
  if (shouldShowMenu) emit('menu', event)
}
</script>
