<template>
  <AppDialogPanel
    body-class="flex flex-col gap-2 text-sm text-muted-foreground"
    data-testid="builder-empty-workflow-dialog"
    class="w-xl max-w-full min-w-116"
  >
    <template #title>
      {{ $t('builderToolbar.emptyWorkflowTitle') }}
    </template>

    <p class="m-0">
      {{ $t('linearMode.emptyWorkflowExplanation') }}
    </p>
    <p class="m-0">
      {{ $t('builderToolbar.emptyWorkflowPrompt') }}
    </p>

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
  </AppDialogPanel>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'

defineEmits<{
  backToWorkflow: []
  loadTemplate: []
}>()
</script>
