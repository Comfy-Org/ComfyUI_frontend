<template>
  <BaseWorkflowsSidebarTab
    :title="$t('linearMode.appModeToolbar.apps')"
    :filter="isAppWorkflow"
    :label-transform="stripAppJsonSuffix"
    hide-leaf-icon
    :search-subject="$t('linearMode.appModeToolbar.apps')"
    data-testid="apps-sidebar"
  >
    <template #alt-title>
      <span
        class="ml-2 flex items-center rounded-full bg-primary-background px-1.5 py-0.5 text-xxs text-base-foreground uppercase"
      >
        {{ $t('g.beta') }}
      </span>
    </template>
    <template #empty-state>
      <NoResultsPlaceholder
        button-variant="secondary"
        text-class="text-muted-foreground text-sm"
        :message="$t('linearMode.appModeToolbar.appsEmptyMessage')"
        :button-label="$t('linearMode.appModeToolbar.enterAppMode')"
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

const { setMode } = useAppMode()

function isAppWorkflow(workflow: ComfyWorkflow): boolean {
  return workflow.suffix === 'app.json'
}

function stripAppJsonSuffix(label: string): string {
  return label.replace(/\.app\.json$/i, '')
}

function enterAppMode() {
  setMode('app')
}
</script>
