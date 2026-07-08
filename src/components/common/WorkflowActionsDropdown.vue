<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot
} from 'reka-ui'
import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkflowActionsList from '@/components/common/WorkflowActionsList.vue'
import Button from '@/components/ui/button/Button.vue'
import { useNewMenuItemIndicator } from '@/composables/useNewMenuItemIndicator'
import { useWorkflowActionsMenu } from '@/composables/useWorkflowActionsMenu'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import type { ViewMode } from '@/utils/appMode'

interface ViewModeSegment {
  mode: ViewMode
  icon: string
  label: string
  switchLabel: string
  switchTooltip: string
  /** Drives behavior and aria; flips as soon as the mode changes. */
  active: boolean
  /** Frame-lagged mirror of {@link active} that drives the morph order. */
  displayActive: boolean
}

const { source, align = 'start' } = defineProps<{
  source: string
  align?: 'start' | 'center' | 'end'
}>()

const { t } = useI18n()
const keybindingStore = useKeybindingStore()
const dropdownOpen = ref(false)
const appModeStore = useAppModeStore()

const { menuItems } = useWorkflowActionsMenu(
  () => useCommandStore().execute('Comfy.RenameWorkflow'),
  { isRoot: true }
)
const { hasUnseenItems, markAsSeen } = useNewMenuItemIndicator(
  () => menuItems.value
)

const toggleShortcut = computed(() => {
  const shortcut = keybindingStore
    .getKeybindingByCommandId('Comfy.ToggleLinear')
    ?.combo.toString()
  return shortcut ? t('g.shortcutSuffix', { shortcut }) : ''
})

const segments = computed<ViewModeSegment[]>(() =>
  (
    [
      {
        mode: 'graph',
        icon: 'icon-[comfy--workflow]',
        label: t('breadcrumbsMenu.graph'),
        switchLabel: t('breadcrumbsMenu.enterNodeGraph'),
        switchTooltip:
          t('breadcrumbsMenu.enterNodeGraph') + toggleShortcut.value
      },
      {
        mode: 'app',
        icon: 'icon-[lucide--panels-top-left]',
        label: t('breadcrumbsMenu.app'),
        switchLabel: t('breadcrumbsMenu.enterAppMode'),
        switchTooltip: t('breadcrumbsMenu.enterAppMode') + toggleShortcut.value
      }
    ] as const
  ).map((seg) => ({
    ...seg,
    active: appModeStore.viewMode === seg.mode,
    displayActive: appModeStore.displayViewMode === seg.mode
  }))
)

// Display-inactive segment first (left), display-active last (right). The
// reorder on mode switch is what TransitionGroup FLIP-animates.
const orderedSegments = computed(() => {
  const [graph, app] = segments.value
  return graph.displayActive ? [app, graph] : [graph, app]
})

const toggleContainer = useTemplateRef<HTMLDivElement>('toggleContainer')

// The active segment is the only element with popup semantics.
function activeSegmentElement() {
  return (
    toggleContainer.value?.querySelector<HTMLElement>(
      '[aria-haspopup="menu"]'
    ) ?? undefined
  )
}

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
  if (!dropdownOpen.value) return
  markAsSeen()
  useTelemetry()?.trackUiButtonClicked({
    button_id: source,
    element_group: 'workflow_actions'
  })
}

function switchMode() {
  dropdownOpen.value = false
  void useCommandStore().execute('Comfy.ToggleLinear', {
    metadata: { source }
  })
}

function onSegmentClick(seg: ViewModeSegment) {
  if (seg.active) toggleDropdown()
  else switchMode()
}

// Match the stock dropdown trigger: ArrowDown on the trigger opens the menu.
function onSegmentKeydown(seg: ViewModeSegment, e: KeyboardEvent) {
  if (!seg.active || e.key !== 'ArrowDown') return
  e.preventDefault()
  if (!dropdownOpen.value) toggleDropdown()
}

// A stock DropdownMenuTrigger would break the FLIP morph, so re-create its two
// behaviors: clicking the open trigger toggles closed (not dismiss-then-reopen),
// and focus returns to the trigger on close unless the user interacted outside.
let interactedOutside = false
function onInteractOutside(event: PointerDownOutsideEvent | FocusOutsideEvent) {
  const target = event.target
  if (target instanceof Node && activeSegmentElement()?.contains(target)) {
    event.preventDefault()
    return
  }
  interactedOutside = true
}

function onCloseAutoFocus(event: Event) {
  event.preventDefault()
  if (!interactedOutside) activeSegmentElement()?.focus()
  interactedOutside = false
}

const tooltipPt = {
  root: {
    style: {
      transform: 'translateX(calc(50% - 16px))',
      whiteSpace: 'nowrap',
      maxWidth: 'none'
    }
  },
  text: {
    style: { whiteSpace: 'nowrap' }
  },
  arrow: {
    style: { left: '16px' }
  }
}
</script>

<template>
  <DropdownMenuRoot v-model:open="dropdownOpen" :modal="false">
    <div
      ref="toggleContainer"
      data-testid="view-mode-toggle"
      class="group pointer-events-auto relative inline-block rounded-lg bg-base-background p-1"
      :data-state="dropdownOpen ? 'open' : 'closed'"
    >
      <TransitionGroup
        tag="div"
        move-class="transition-[background-color,color,transform] duration-200"
        class="flex items-center gap-1"
      >
        <Button
          v-for="seg in orderedSegments"
          :key="seg.mode"
          v-tooltip.bottom="{
            value: seg.active
              ? t('breadcrumbsMenu.workflowActions')
              : seg.switchTooltip,
            showDelay: 300,
            hideDelay: 300,
            pt: seg.active ? undefined : tooltipPt
          }"
          type="button"
          variant="textonly"
          size="unset"
          :aria-label="
            seg.active
              ? t('breadcrumbsMenu.activeModeWorkflowActions', {
                  mode: seg.label
                })
              : seg.switchLabel
          "
          :aria-haspopup="seg.active ? 'menu' : undefined"
          :aria-expanded="seg.active ? dropdownOpen : undefined"
          :class="
            cn(
              'relative flex h-8 items-center gap-0 rounded-md font-normal transition-[background-color,color,transform] duration-200',
              seg.displayActive
                ? 'bg-secondary-background pr-2 pl-2.5 text-base-foreground group-data-[state=open]:bg-secondary-background-hover group-data-[state=open]:shadow-interface hover:bg-secondary-background'
                : 'w-8 justify-center bg-transparent text-muted-foreground hover:bg-secondary-background hover:text-base-foreground'
            )
          "
          @click="onSegmentClick(seg)"
          @keydown="onSegmentKeydown(seg, $event)"
        >
          <i :class="cn('size-4 shrink-0', seg.icon)" aria-hidden="true" />
          <span
            :class="
              cn(
                'grid transition-[grid-template-columns,opacity] duration-200',
                seg.displayActive
                  ? 'ml-1.5 grid-cols-[1fr] opacity-100'
                  : 'grid-cols-[0fr] opacity-0'
              )
            "
          >
            <span
              class="flex min-w-0 items-center overflow-hidden text-sm leading-none whitespace-nowrap"
            >
              {{ seg.label }}
              <i
                class="ml-1 icon-[lucide--chevron-down] size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
          </span>
          <span
            v-if="seg.active && hasUnseenItems"
            aria-hidden="true"
            class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary-background"
          />
        </Button>
      </TransitionGroup>
    </div>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :align
        :aria-label="t('breadcrumbsMenu.workflowActions')"
        :reference="toggleContainer ?? undefined"
        :side-offset="8"
        :collision-padding="10"
        class="z-1000 min-w-56 rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
        @interact-outside="onInteractOutside"
        @close-auto-focus="onCloseAutoFocus"
      >
        <WorkflowActionsList :items="menuItems" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
