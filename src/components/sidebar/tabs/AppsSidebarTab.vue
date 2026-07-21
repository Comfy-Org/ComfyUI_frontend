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
    <template #header-actions="{ hasResults }">
      <Button
        v-if="hasResults"
        variant="secondary"
        size="md"
        @click="createApp"
      >
        <i class="icon-[lucide--plus] size-4" aria-hidden="true" />
        {{ $t('linearMode.appModeToolbar.create') }}
      </Button>
    </template>
    <template #empty-state>
      <NoResultsPlaceholder
        button-variant="secondary"
        text-class="text-muted-foreground text-sm"
        :message="`${$t('linearMode.appModeToolbar.appsEmptyMessage')}\n${$t('linearMode.appModeToolbar.appsEmptyMessageAction')}`"
        button-icon="icon-[lucide--plus]"
        :button-label="$t('linearMode.appModeToolbar.createApp')"
        @action="createApp"
      />
    </template>
  </BaseWorkflowsSidebarTab>
</template>

<script setup lang="ts">
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import BaseWorkflowsSidebarTab from '@/components/sidebar/tabs/BaseWorkflowsSidebarTab.vue'
import Button from '@/components/ui/button/Button.vue'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()

function isAppWorkflow(workflow: ComfyWorkflow): boolean {
  return workflow.suffix === 'app.json'
}

function createApp() {
  void commandStore.execute('Comfy.NewBlankWorkflow')
}
</script>
