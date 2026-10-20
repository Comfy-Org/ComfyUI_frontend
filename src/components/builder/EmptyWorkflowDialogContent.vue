<template>
  <DialogPanel
    data-testid="builder-empty-workflow-dialog"
    class="w-xl max-w-full min-w-116"
  >
    <template #title>
      {{ $t('builderToolbar.emptyWorkflowTitle') }}
    </template>

    <div class="flex flex-col gap-2 p-4 text-sm text-muted-foreground">
      <p class="m-0">
        {{ $t('linearMode.emptyWorkflowExplanation') }}
      </p>
      <p class="m-0">
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
  </DialogPanel>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'

defineEmits<{
  backToWorkflow: []
  loadTemplate: []
}>()
</script>
