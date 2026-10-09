<template>
  <BaseWorkflowsSidebarTab
    :title="$t('sideToolbar.workflows')"
    :search-subject="$t('g.workflow')"
    data-testid="workflows-sidebar"
  >
    <template #header-actions>
      <Button
        v-if="isCloud"
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('testWorkflowLibrary.title')"
        :title="$t('testWorkflowLibrary.title')"
        @click="library.show"
      >
        <i class="icon-[lucide--library] size-4" aria-hidden="true" />
      </Button>
    </template>
  </BaseWorkflowsSidebarTab>
</template>

<script setup lang="ts">
import BaseWorkflowsSidebarTab from '@/components/sidebar/tabs/BaseWorkflowsSidebarTab.vue'
import Button from '@/components/ui/button/Button.vue'
import { isCloud } from '@/platform/distribution/types'
import { useTestWorkflowLibraryDialog } from '@/platform/workflow/library/composables/useTestWorkflowLibraryDialog'

const library = useTestWorkflowLibraryDialog()
</script>
