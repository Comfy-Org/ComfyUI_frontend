<script lang="ts">
// A segment switch unmounts the focused toggle instance and mounts a fresh
// one in the other mode's host, so the focus handoff is tracked at module
// scope where both instances can reach it.
let restoreFocusOnMount = false
</script>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
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

function onOpenChange(open: boolean) {
  dropdownOpen.value = open
  if (!open) return
  markAsSeen()
  useTelemetry()?.trackUiButtonClicked({
    button_id: source,
    element_group: 'workflow_actions'
  })
}

function switchMode() {
  dropdownOpen.value = false
  restoreFocusOnMount = true
  void useCommandStore().execute('Comfy.ToggleLinear', {
    metadata: { source }
  })
}

function onSegmentClick(seg: ViewModeSegment, event: MouseEvent) {
  if (seg.active) return
  event.stopPropagation()
  switchMode()
}

/** Keys the reka trigger opens the menu on; other keys bubble on so app-level
 *  keybindings keep working while a segment has focus. */
const MENU_TRIGGER_KEYS = new Set(['Enter', ' ', 'ArrowDown'])

function onSegmentKeydown(seg: ViewModeSegment, event: KeyboardEvent) {
  if (!seg.active && MENU_TRIGGER_KEYS.has(event.key)) event.stopPropagation()
}

const toggleRef = useTemplateRef<HTMLDivElement>('toggleRef')

// The trigger div carries role="group" (permitting the aria-label, prohibited
// on a plain div, that names the menu via reka's aria-labelledby) and
// tabindex="-1" so reka's close-focus (e.g. Escape closing the menu) lands
// there; its @focus forwards focus here, to the active segment. Also called
// when this instance mounts to replace the one unmounted by a
// segment-initiated mode switch.
function focusActiveSegment() {
  toggleRef.value
    ?.querySelector<HTMLButtonElement>('button[aria-haspopup]')
    ?.focus()
}

onMounted(async () => {
  if (!restoreFocusOnMount) return
  restoreFocusOnMount = false
  await nextTick()
  focusActiveSegment()
})

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
  <DropdownMenuRoot
    :open="dropdownOpen"
    :modal="false"
    @update:open="onOpenChange"
  >
    <DropdownMenuTrigger as-child>
      <div
        ref="toggleRef"
        data-testid="view-mode-toggle"
        role="group"
        tabindex="-1"
        :aria-label="t('breadcrumbsMenu.workflowActions')"
        class="group pointer-events-auto relative inline-block shrink-0 rounded-lg bg-base-background p-1"
        @focus="focusActiveSegment"
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
            @click="onSegmentClick(seg, $event)"
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
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :align
        :side-offset="8"
        :collision-padding="10"
        class="z-1000 min-w-56 rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
      >
        <WorkflowActionsList :items="menuItems" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
