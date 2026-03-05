<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkflowActionsList from '@/components/common/WorkflowActionsList.vue'
import Button from '@/components/ui/button/Button.vue'
import { useNewMenuItemIndicator } from '@/composables/useNewMenuItemIndicator'
import { useWorkflowActionsMenu } from '@/composables/useWorkflowActionsMenu'
import { useTelemetry } from '@/platform/telemetry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

const { source, align = 'start' } = defineProps<{
  source: string
  align?: 'start' | 'center' | 'end'
}>()

const { t } = useI18n()
const canvasStore = useCanvasStore()
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
      button_id: source
    })
  }
}

function toggleLinearMode() {
  dropdownOpen.value = false
  void useCommandStore().execute('Comfy.ToggleLinear', {
    metadata: { source }
  })
}
</script>

<template>
  <DropdownMenuRoot v-model:open="dropdownOpen" @update:open="handleOpen">
    <slot name="button" :has-unseen-items="hasUnseenItems">
      <div
        class="inline-flex items-center rounded-lg bg-secondary-background pointer-events-auto"
      >
        <Button
          v-tooltip="{
            value: canvasStore.linearMode
              ? t('breadcrumbsMenu.enterNodeGraph')
              : t('breadcrumbsMenu.enterAppMode'),
            showDelay: 300,
            hideDelay: 300
          }"
          :aria-label="
            canvasStore.linearMode
              ? t('breadcrumbsMenu.enterNodeGraph')
              : t('breadcrumbsMenu.enterAppMode')
          "
          variant="base"
          class="m-1"
          @pointerdown.stop
          @click="toggleLinearMode"
        >
          <i
            class="size-4"
            :class="
              canvasStore.linearMode
                ? 'icon-[lucide--panels-top-left]'
                : 'icon-[comfy--workflow]'
            "
          />
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
            class="relative h-10 rounded-lg pl-2.5 pr-2 gap-1 text-center data-[state=open]:bg-secondary-background-hover data-[state=open]:shadow-interface"
          >
            <span>{{
              canvasStore.linearMode
                ? t('breadcrumbsMenu.app')
                : t('breadcrumbsMenu.graph')
            }}</span>
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
        class="z-1000 rounded-lg px-2 py-3 min-w-56 bg-base-background shadow-interface border border-border-subtle"
      >
        <WorkflowActionsList :items="menuItems" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
