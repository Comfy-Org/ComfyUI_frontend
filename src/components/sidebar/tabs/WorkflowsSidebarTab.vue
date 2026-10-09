<template>
  <BaseWorkflowsSidebarTab
    :title="$t('sideToolbar.workflows')"
    :search-subject="$t('g.workflow')"
    data-testid="workflows-sidebar"
  >
    <template #footer>
      <div v-if="isCloud" class="shrink-0 border-t border-border-default p-3">
        <Button
          variant="secondary"
          class="w-full justify-start gap-2"
          @click="library.show"
        >
          <i class="icon-[lucide--library] size-4" aria-hidden="true" />
          {{ $t('testWorkflowLibrary.title') }}
        </Button>
      </div>
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
