import { type ComputedRef, type Ref, computed, unref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { cn } from '@/utils/tailwindUtil'

export interface NodePresentationOptions {
  readonly?: boolean
  isPreview?: boolean
  scale?: number
  // Interactive node state
  isSelected?: ComputedRef<boolean>
  executing?: ComputedRef<boolean>
  progress?: ComputedRef<number | undefined>
  hasExecutionError?: ComputedRef<boolean>
  hasAnyError?: ComputedRef<boolean>
  bypassed?: ComputedRef<boolean>
  isDragging?: ComputedRef<boolean> | Ref<boolean>
  shouldHandleNodePointerEvents?: ComputedRef<boolean>
}

export interface NodePresentationState {
  // Classes
  containerBaseClasses: ComputedRef<string>
  separatorClasses: string
  progressClasses: string
  // Computed states
  isCollapsed: ComputedRef<boolean>
  showProgress: ComputedRef<boolean>
  progressStyle: ComputedRef<{ width: string } | undefined>
  progressBarStyle: ComputedRef<{ width: string } | undefined>
  progressBarClasses: ComputedRef<string>
  borderClass: ComputedRef<string | undefined>
  outlineClass: ComputedRef<string | undefined>
}

export function useNodePresentation(
  nodeData: () => VueNodeData | undefined,
  options: NodePresentationOptions = {}
): NodePresentationState {
  const {
    isPreview = false,
    isSelected,
    executing,
    progress,
    hasAnyError,
    bypassed,
    isDragging,
    shouldHandleNodePointerEvents
  } = options

  // Collapsed state
  const isCollapsed = computed(() => nodeData()?.flags?.collapsed ?? false)

  // Show progress when executing with defined progress
  const showProgress = computed(() => {
    if (isPreview) return false
    return !!(executing?.value && progress?.value !== undefined)
  })

  // Progress styles
  const progressStyle = computed(() => {
    if (!showProgress.value || !progress?.value) return undefined
    return { width: `${Math.min(progress.value * 100, 100)}%` }
  })

  const progressBarStyle = progressStyle

  // Border class based on state
  const borderClass = computed(() => {
    if (isPreview) return undefined
    if (hasAnyError?.value) {
      return 'border-error'
    }
    if (executing?.value) {
      return 'border-blue-500'
    }
    return undefined
  })

  // Outline class based on selection and state
  const outlineClass = computed(() => {
    if (isPreview) return undefined
    if (!isSelected?.value) {
      return undefined
    }
    if (hasAnyError?.value) {
      return 'outline-error'
    }
    if (executing?.value) {
      return 'outline-blue-500'
    }
    return 'outline-black dark-theme:outline-white'
  })

  // Container base classes (without dynamic state classes)
  const containerBaseClasses = computed(() => {
    if (isPreview) {
      return cn(
        'bg-white dark-theme:bg-charcoal-800',
        'lg-node absolute rounded-2xl',
        'border border-solid border-sand-100 dark-theme:border-charcoal-600',
        'outline-transparent -outline-offset-2 outline-2',
        'pointer-events-none'
      )
    }

    return cn(
      'bg-white dark-theme:bg-charcoal-800',
      'lg-node absolute rounded-2xl',
      'border border-solid border-sand-100 dark-theme:border-charcoal-600',
      // hover (only when node should handle events)
      shouldHandleNodePointerEvents?.value &&
        'hover:ring-7 ring-gray-500/50 dark-theme:ring-gray-500/20',
      'outline-transparent -outline-offset-2 outline-2',
      borderClass.value,
      outlineClass.value,
      {
        'animate-pulse': executing?.value,
        'opacity-50 before:rounded-2xl before:pointer-events-none before:absolute before:bg-bypass/60 before:inset-0':
          bypassed?.value,
        'will-change-transform': unref(isDragging)
      },
      shouldHandleNodePointerEvents?.value
        ? 'pointer-events-auto'
        : 'pointer-events-none'
    )
  })

  const progressBarClasses = computed(() => {
    return cn(
      'absolute inset-x-4 -bottom-[1px] translate-y-1/2 rounded-full',
      progressClasses
    )
  })

  // Static classes
  const separatorClasses =
    'bg-sand-100 dark-theme:bg-charcoal-600 h-px mx-0 w-full lod-toggle'
  const progressClasses = 'h-2 bg-primary-500 transition-all duration-300'

  return {
    containerBaseClasses,
    separatorClasses,
    progressClasses,
    isCollapsed,
    showProgress,
    progressStyle,
    progressBarStyle,
    progressBarClasses,
    borderClass,
    outlineClass
  }
}
