<template>
  <Menu v-model:open="open" :items="menuItems" class="min-w-56">
    <template #trigger>
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
  </Menu>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem, MenuItemCommandEvent } from '@/components/ui/menu/types'
import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const { hasOutputs } = storeToRefs(appModeStore)
const { setMode } = useAppMode()
const workflowService = useWorkflowService()
const workflowStore = useWorkflowStore()
const { toastErrorHandler } = useErrorHandling()
const open = ref(false)

const menuItems = computed<MenuItem[]>(() => [
  {
    label: t('g.save'),
    icon: 'icon-[lucide--save]',
    disabled: !hasOutputs.value,
    command: onSave
  },
  { separator: true },
  {
    label: t('builderMenu.enterAppMode'),
    icon: 'icon-[lucide--panels-top-left]',
    command: onEnterAppMode
  },
  { separator: true },
  {
    label: t('builderMenu.exitAppBuilder'),
    icon: 'icon-[lucide--x]',
    command: onExitBuilder
  }
])

async function onSave({ originalEvent }: MenuItemCommandEvent) {
  originalEvent.preventDefault()
  const workflow = workflowStore.activeWorkflow
  if (!workflow) return
  try {
    const saved = await workflowService.saveWorkflow(workflow)
    if (saved) open.value = false
  } catch (error) {
    toastErrorHandler(error)
  }
}

function onEnterAppMode() {
  setMode('app')
}

function onExitBuilder() {
  appModeStore.exitBuilder()
}
</script>
