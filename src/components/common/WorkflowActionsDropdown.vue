<script setup lang="ts">
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
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

const { source, align = 'start' } = defineProps<{
  source: string
  align?: 'start' | 'center' | 'end'
}>()

const { t } = useI18n()
const canvasStore = useCanvasStore()
const keybindingStore = useKeybindingStore()
const dropdownOpen = ref(false)

const { menuItems } = useWorkflowActionsMenu(
  () => useCommandStore().execute('Comfy.RenameWorkflow'),
  { isRoot: true }
)

const { hasUnseenItems, markAsSeen } = useNewMenuItemIndicator(
  () => menuItems.value
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

const isGraphMode = computed(
  () => !canvasStore.linearMode && !canvasStore.apiMode
)

function appModeTooltip() {
  const shortcut = keybindingStore
    .getKeybindingByCommandId('Comfy.ToggleLinear')
    ?.combo.toString()
  return (
    t('breadcrumbsMenu.enterAppMode') +
    (shortcut ? t('g.shortcutSuffix', { shortcut }) : '')
  )
}

function enterGraphMode() {
  dropdownOpen.value = false
  canvasStore.linearMode = false
  canvasStore.apiMode = false
}

function enterAppMode() {
  dropdownOpen.value = false
  if (!canvasStore.linearMode) {
    useTelemetry()?.trackEnterLinear({ source })
  }
  canvasStore.linearMode = true
}

function enterApiMode() {
  dropdownOpen.value = false
  canvasStore.apiMode = true
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
    class: '!left-[16px]'
  }
}
</script>

<template>
  <DropdownMenuRoot
    v-model:open="dropdownOpen"
    :modal="false"
    @update:open="handleOpen"
  >
    <slot name="button" :has-unseen-items="hasUnseenItems">
      <div
        class="pointer-events-auto inline-flex items-center rounded-lg bg-secondary-background"
      >
        <Button
          v-tooltip.bottom="{
            value: appModeTooltip(),
            showDelay: 300,
            hideDelay: 300,
            pt: tooltipPt
          }"
          :aria-label="t('breadcrumbsMenu.enterAppMode')"
          variant="base"
          class="m-1"
          :class="{ 'bg-secondary-background-hover': !canvasStore.linearMode }"
          @pointerdown.stop
          @click="enterAppMode"
        >
          <i class="icon-[lucide--panels-top-left] size-4" />
        </Button>
        <Button
          v-tooltip.bottom="{
            value: t('breadcrumbsMenu.enterApiMode'),
            showDelay: 300,
            hideDelay: 300,
            pt: tooltipPt
          }"
          :aria-label="t('breadcrumbsMenu.enterApiMode')"
          variant="base"
          class="m-1"
          :class="{ 'bg-secondary-background-hover': !canvasStore.apiMode }"
          @pointerdown.stop
          @click="enterApiMode"
        >
          <i class="icon-[lucide--cloud] size-4" />
        </Button>
        <Button
          v-tooltip.bottom="{
            value: t('breadcrumbsMenu.enterGraphMode'),
            showDelay: 300,
            hideDelay: 300,
            pt: tooltipPt
          }"
          :aria-label="t('breadcrumbsMenu.enterGraphMode')"
          variant="base"
          class="m-1"
          :class="{ 'bg-secondary-background-hover': !isGraphMode }"
          @pointerdown.stop
          @click="enterGraphMode"
        >
          <i class="icon-[comfy--workflow] size-4" />
        </Button>
        <DropdownMenuTrigger as-child>
          <Button
            v-tooltip="{
              value: t('breadcrumbsMenu.workflowActions'),
              showDelay: 300,
              hideDelay: 300
            }"
            variant="secondary"
            size="unset"
            :aria-label="t('breadcrumbsMenu.workflowActions')"
            class="relative h-10 gap-1 rounded-lg pr-2 pl-2.5 text-center data-[state=open]:bg-secondary-background-hover data-[state=open]:shadow-interface"
          >
            <span>{{ t('breadcrumbsMenu.actions') }}</span>
            <i
              class="icon-[lucide--chevron-down] size-4 text-muted-foreground"
            />
            <span
              v-if="hasUnseenItems"
              aria-hidden="true"
              class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary-background"
            />
          </Button>
        </DropdownMenuTrigger>
      </div>
    </slot>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :align
        :side-offset="5"
        :collision-padding="10"
        class="z-1000 min-w-56 rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
      >
        <WorkflowActionsList :items="menuItems" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
