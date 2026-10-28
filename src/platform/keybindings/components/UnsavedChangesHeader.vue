<template>
  <div class="flex w-full items-center p-4">
    <p class="m-0 text-sm font-medium">
      {{ $t('g.keybindingPresets.unsavedChangesTo', { name: presetName }) }}
    </p>
  </div>
</template>

<script setup lang="ts">
const { presetName } = defineProps<{
  presetName: string
}>()
</script>
