<template>
  <BuilderDialog
    data-testid="builder-empty-workflow-dialog"
    :show-close="false"
  >
    <template #title>
      {{ $t('builderToolbar.emptyWorkflowTitle') }}
    </template>

    <div class="flex flex-col gap-2">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('linearMode.emptyWorkflowExplanation') }}
      </p>
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('builderToolbar.emptyWorkflowPrompt') }}
      </p>
    </div>

    <template #footer>
      <Button
        variant="muted-textonly"
        size="lg"
        data-testid="builder-empty-workflow-back"
        @click="$emit('backToWorkflow')"
      >
        {{ $t('linearMode.backToWorkflow') }}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        data-testid="builder-empty-workflow-load-template"
        @click="$emit('loadTemplate')"
      >
        {{ $t('linearMode.loadTemplate') }}
      </Button>
    </template>
  </BuilderDialog>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

import BuilderDialog from './BuilderDialog.vue'

defineEmits<{
  backToWorkflow: []
  loadTemplate: []
}>()
</script>
