<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import WorkflowActionsList from '@/components/common/WorkflowActionsList.vue'
import Button from '@/components/ui/button/Button.vue'
import { useNewMenuItemIndicator } from '@/components/common/useNewMenuItemIndicator'
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
</script>

<template>
  <DropdownMenuRoot @update:open="handleOpen">
    <DropdownMenuTrigger as-child>
      <slot name="button" :has-unseen-items="hasUnseenItems">
        <Button
          v-tooltip="{
            value: t('breadcrumbsMenu.workflowActions'),
            showDelay: 300,
            hideDelay: 300
          }"
          variant="secondary"
          size="unset"
          :aria-label="t('breadcrumbsMenu.workflowActions')"
          class="pointer-events-auto relative h-10 gap-1 rounded-lg pr-2 pl-3 data-[state=open]:bg-secondary-background-hover data-[state=open]:shadow-interface"
        >
          <i
            class="size-4"
            :class="
              canvasStore.linearMode
                ? 'icon-[lucide--panels-top-left]'
                : 'icon-[comfy--workflow]'
            "
          />
          <i class="icon-[lucide--chevron-down] size-4 text-muted-foreground" />
          <span
            v-if="hasUnseenItems"
            aria-hidden="true"
            class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary-background"
          />
        </Button>
      </slot>
    </DropdownMenuTrigger>
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
