<template>
  <div class="load-workflow-error flex flex-col gap-4">
    <p>Loading aborted due to error reloading workflow data</p>

    <pre class="error-message p-5 bg-red-500/20">{{ error }}</pre>

    <pre
      class="stack-trace p-5 text-neutral-400 text-xs max-h-[50vh] overflow-auto bg-black/20"
    >
      {{ stackTrace }}
    </pre>

    <template v-if="extensionFile">
      <span>This may be due to the following script:</span>
      <br />
      <span class="font-bold">{{ extensionFile }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  error: Error
  stackTrace: string
  extensionFile?: string
}>()
</script>
