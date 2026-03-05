<template>
  <BuilderDialog :show-close="false">
    <template #title>
      {{ $t('builderToolbar.emptyWorkflowTitle') }}
    </template>

    <div class="flex flex-col gap-2">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('builderToolbar.emptyWorkflowExplanation') }}
      </p>
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('builderToolbar.emptyWorkflowPrompt') }}
      </p>
    </div>

    <template #footer>
      <Button
        variant="muted-textonly"
        size="lg"
        @click="$emit('backToWorkflow')"
      >
        {{ $t('builderToolbar.backToWorkflow') }}
      </Button>
      <Button variant="secondary" size="lg" @click="$emit('loadTemplate')">
        {{ $t('builderToolbar.loadTemplate') }}
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
