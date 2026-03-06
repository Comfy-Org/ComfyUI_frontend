<template>
  <Popover :show-arrow="false" class="min-w-56 p-3">
    <template #button>
      <button
        :class="
          cn(
            'absolute top-[calc(var(--workflow-tabs-height)+16px)] left-4 z-1000 inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border-none py-2 pr-2 pl-3 shadow-interface transition-colors',
            'bg-secondary-background hover:bg-secondary-background-hover',
            'data-[state=open]:bg-secondary-background-hover'
          )
        "
        :aria-label="t('linearMode.appModeToolbar.appBuilder')"
      >
        <i class="icon-[lucide--hammer] size-4" />
        <span class="text-sm font-medium">
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
    icon: 'icon-[lucide--square-pen]',
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
