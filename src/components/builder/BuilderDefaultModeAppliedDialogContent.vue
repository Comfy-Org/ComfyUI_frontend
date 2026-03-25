<template>
  <BuilderDialog @close="$emit('close')">
    <template #title>
      <span class="inline-flex items-center gap-2">
        {{ $t('builderToolbar.defaultModeAppliedTitle') }}
        <i
          aria-hidden="true"
          class="icon-[lucide--circle-check-big] size-4 text-green-500"
        />
      </span>
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{
        appliedAsApp
          ? $t('builderToolbar.defaultModeAppliedAppBody')
          : $t('builderToolbar.defaultModeAppliedGraphBody')
      }}
    </p>
    <p class="m-0 text-sm text-muted-foreground">
      {{
        appliedAsApp
          ? $t('builderToolbar.defaultModeAppliedAppPrompt')
          : $t('builderToolbar.defaultModeAppliedGraphPrompt')
      }}
    </p>

    <template #footer>
      <template v-if="appliedAsApp">
        <Button variant="muted-textonly" size="lg" @click="$emit('close')">
          {{ $t('g.close') }}
        </Button>
        <Button variant="secondary" size="lg" @click="$emit('viewApp')">
          {{ $t('builderToolbar.viewApp') }}
        </Button>
      </template>
      <template v-else>
        <Button variant="muted-textonly" size="lg" @click="$emit('viewApp')">
          {{ $t('builderToolbar.viewApp') }}
        </Button>
        <Button variant="secondary" size="lg" @click="$emit('exitToWorkflow')">
          {{ $t('builderToolbar.exitToWorkflow') }}
        </Button>
      </template>
    </template>
  </BuilderDialog>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

import BuilderDialog from './BuilderDialog.vue'

defineProps<{
  appliedAsApp: boolean
}>()

defineEmits<{
  viewApp: []
  close: []
  exitToWorkflow: []
}>()
</script>
