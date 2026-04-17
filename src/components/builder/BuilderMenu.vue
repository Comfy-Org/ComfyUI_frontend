<template>
  <Popover :show-arrow="false" class="min-w-56 p-3">
    <template #button>
      <button
        :class="
          cn(
            'builder-menu-trigger absolute z-1000 inline-flex cursor-pointer items-center gap-2 border-none transition-colors',
            'hover:bg-(--layout-color-cell-hover)',
            'data-[state=open]:bg-(--layout-color-cell-hover)'
          )
        "
        :aria-label="t('linearMode.appModeToolbar.appBuilder')"
      >
        <i class="icon-[lucide--hammer] size-5" />
        <span class="text-base font-medium">
          {{ t('linearMode.appModeToolbar.appBuilder') }}
        </span>
        <i class="icon-[lucide--chevron-down] size-4 text-muted-foreground" />
      </button>
    </template>
    <template #default="{ close }">
      <template v-for="(item, index) in menuItems" :key="item.label">
        <div v-if="index > 0" class="my-1 border-t border-border-default" />
        <Button
          variant="textonly"
          size="unset"
          class="flex w-full items-center justify-start gap-3 rounded-md px-3 py-2 text-sm"
          :disabled="item.disabled"
          @click="item.action(close)"
        >
          <i :class="cn(item.icon, 'size-4')" />
          {{ item.label }}
        </Button>
      </template>
    </template>
  </Popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/Popover.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const { hasOutputs } = storeToRefs(appModeStore)
const { setMode } = useAppMode()
const workflowService = useWorkflowService()
const workflowStore = useWorkflowStore()
const { toastErrorHandler } = useErrorHandling()

const menuItems = computed(() => [
  {
    label: t('g.save'),
    icon: 'icon-[lucide--save]',
    disabled: !hasOutputs.value,
    action: onSave
  },
  {
    label: t('builderMenu.enterAppMode'),
    icon: 'icon-[lucide--panels-top-left]',
    action: onEnterAppMode
  },
  {
    label: t('builderMenu.exitAppBuilder'),
    icon: 'icon-[lucide--x]',
    action: onExitBuilder
  }
])

async function onSave(close: () => void) {
  const workflow = workflowStore.activeWorkflow
  if (!workflow) return
  try {
    await workflowService.saveWorkflow(workflow)
    close()
  } catch (error) {
    toastErrorHandler(error)
  }
}

function onEnterAppMode(close: () => void) {
  setMode('app')
  close()
}

function onExitBuilder(close: () => void) {
  appModeStore.exitBuilder()
  close()
}
</script>

<style scoped>
/* Matches ModeToggleCell visual treatment in App Mode: flat cell fill,
   4px radius, 48px tall. Sits just right of the SideToolbar using the
   same --sidebar-width the graph-mode chrome reacts to. */
.builder-menu-trigger {
  top: calc(var(--workflow-tabs-height) + var(--layout-outer-padding));
  left: calc(var(--sidebar-width, 0px) + var(--layout-outer-padding));
  height: var(--layout-cell-size);
  padding: 0 12px;
  color: var(--layout-color-text);
  background-color: var(--layout-color-cell-fill);
  border-radius: var(--layout-cell-radius);
}
</style>
