<template>
  <BaseWorkflowsSidebarTab
    :title="$t('linearMode.appModeToolbar.apps')"
    :filter="isAppWorkflow"
    hide-leaf-icon
    :search-subject="$t('linearMode.appModeToolbar.apps')"
    data-testid="apps-sidebar"
  >
    <template #alt-title>
      <span
        class="ml-2 flex items-center rounded-full bg-primary-background px-1.5 py-0.5 text-2xs text-base-foreground uppercase"
      >
        {{ $t('g.beta') }}
      </span>
    </template>
    <template #empty-state>
      <NoResultsPlaceholder
        button-variant="secondary"
        text-class="text-muted-foreground text-sm"
        :message="
          isAppMode
            ? $t('linearMode.appModeToolbar.appsEmptyMessage')
            : `${$t('linearMode.appModeToolbar.appsEmptyMessage')}\n${$t('linearMode.appModeToolbar.appsEmptyMessageAction')}`
        "
        button-icon="icon-[lucide--hammer]"
        :button-label="isAppMode ? undefined : $t('linearMode.buildAnApp')"
        @action="enterAppMode"
      />
    </template>
  </BaseWorkflowsSidebarTab>
</template>

<script setup lang="ts">
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import BaseWorkflowsSidebarTab from '@/components/sidebar/tabs/BaseWorkflowsSidebarTab.vue'
import { useAppMode } from '@/composables/useAppMode'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

const { isAppMode, setMode } = useAppMode()

function isAppWorkflow(workflow: ComfyWorkflow): boolean {
  return workflow.suffix === 'app.json'
}

function enterAppMode() {
  setMode('app')
}
</script>
