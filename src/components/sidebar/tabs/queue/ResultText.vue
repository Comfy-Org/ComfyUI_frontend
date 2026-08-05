<template>
  <article
    class="m-auto max-h-[80vh] w-[min(90vw,42rem)] scroll-shadows-secondary-background overflow-y-auto rounded-lg bg-secondary-background p-4 whitespace-pre-wrap"
  >
    <span v-if="hasError" class="text-muted-foreground">
      {{ $t('g.textFailedToLoad') }}
    </span>
    <template v-else>{{ textContent }}</template>
  </article>
</template>

<script setup lang="ts">
import { useTextFileContent } from '@/composables/useTextFileContent'
import type { ResultItemImpl } from '@/stores/queueStore'

const { result } = defineProps<{
  result: ResultItemImpl
}>()

const { textContent, hasError } = useTextFileContent(() => result)
</script>
