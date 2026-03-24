<template>
  <BuilderDialog @close="$emit('close')">
    <template #title>
      {{ $t('builderSave.confirmTitle') }}
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('builderSave.confirmBody') }}
    </p>

    <template #footer>
      <Button variant="muted-textonly" size="lg" @click="$emit('close')">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="textonly" size="lg" @click="$emit('saveAsNew')">
        {{ $t('builderSave.saveAsNew') }}
      </Button>
      <Button variant="secondary" size="lg" @click="$emit('save')">
        {{ $t('g.save') }}
      </Button>
    </template>
  </BuilderDialog>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

import BuilderDialog from './BuilderDialog.vue'

defineEmits<{
  close: []
  saveAsNew: []
  save: []
}>()
</script>
