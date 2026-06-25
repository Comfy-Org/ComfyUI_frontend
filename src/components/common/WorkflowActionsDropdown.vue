<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkflowActionsList from '@/components/common/WorkflowActionsList.vue'
import Button from '@/components/ui/button/Button.vue'
import { useNewMenuItemIndicator } from '@/composables/useNewMenuItemIndicator'
import { useWorkflowActionsMenu } from '@/composables/useWorkflowActionsMenu'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useCommandStore } from '@/stores/commandStore'
import { useViewModeToggleStore } from '@/stores/viewModeToggleStore'

type ViewMode = 'graph' | 'app'

interface ViewModeSegment {
  mode: ViewMode
  icon: string
  label: string
  switchLabel: string
  switchTooltip: string
  active: boolean
}

const { source, align = 'start' } = defineProps<{
  source: string
  align?: 'start' | 'center' | 'end'
}>()

const { t } = useI18n()
const keybindingStore = useKeybindingStore()
const dropdownOpen = ref(false)
const { displayLinearMode } = storeToRefs(useViewModeToggleStore())

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

const segments = computed<ViewModeSegment[]>(() => [
  {
    mode: 'graph',
    icon: 'icon-[comfy--workflow]',
    label: t('breadcrumbsMenu.graph'),
    switchLabel: t('breadcrumbsMenu.enterNodeGraph'),
    switchTooltip: t('breadcrumbsMenu.enterNodeGraph') + toggleShortcut.value,
    active: !displayLinearMode.value
  },
  {
    mode: 'app',
    icon: 'icon-[lucide--panels-top-left]',
    label: t('breadcrumbsMenu.app'),
    switchLabel: t('breadcrumbsMenu.enterAppMode'),
    switchTooltip: t('breadcrumbsMenu.enterAppMode') + toggleShortcut.value,
    active: displayLinearMode.value
  }
])

// Inactive segment first (left), active last (right). On mode switch the array
// reorders and TransitionGroup FLIP-animates the keyed nodes to their new spots.
const orderedSegments = computed(() =>
  [...segments.value].sort((a, b) => Number(a.active) - Number(b.active))
)

function handleOpen(open: boolean) {
  if (open) {
    markAsSeen()
    useTelemetry()?.trackUiButtonClicked({
      button_id: source,
      element_group: 'workflow_actions'
    })
  }
}

function switchMode() {
  dropdownOpen.value = false
  void useCommandStore().execute('Comfy.ToggleLinear', {
    metadata: { source }
  })
}

// The container is the dropdown trigger, so an inactive segment must stop its
// pointer event from bubbling up and opening the menu instead of switching.
function onSegmentPointerDown(seg: ViewModeSegment, e: PointerEvent) {
  if (!seg.active) e.stopPropagation()
}

function onSegmentClick(seg: ViewModeSegment, e: MouseEvent) {
  if (seg.active) return
  e.stopPropagation()
  switchMode()
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
  <DropdownMenuRoot
    v-model:open="dropdownOpen"
    :modal="false"
    @update:open="handleOpen"
  >
    <DropdownMenuTrigger as-child>
      <div
        data-testid="view-mode-toggle"
        class="group pointer-events-auto relative inline-block rounded-lg bg-base-background p-1"
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
                ? t('breadcrumbsMenu.workflowActions')
                : seg.switchLabel
            "
            :class="
              cn(
                'relative flex h-8 items-center gap-0 rounded-md font-normal transition-[background-color,color,transform] duration-200',
                seg.active
                  ? 'bg-secondary-background pr-2 pl-2.5 text-base-foreground group-data-[state=open]:bg-secondary-background-hover group-data-[state=open]:shadow-interface hover:bg-secondary-background'
                  : 'w-8 justify-center bg-transparent text-muted-foreground hover:bg-secondary-background hover:text-base-foreground'
              )
            "
            @pointerdown="onSegmentPointerDown(seg, $event)"
            @click="onSegmentClick(seg, $event)"
          >
            <i :class="cn('size-4 shrink-0', seg.icon)" aria-hidden="true" />
            <span
              :class="
                cn(
                  'grid transition-[grid-template-columns,opacity] duration-200',
                  seg.active
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
