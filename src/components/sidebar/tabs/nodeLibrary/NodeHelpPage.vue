<template>
  <div class="flex flex-col h-full bg-[var(--p-tree-background)] overflow-auto">
    <div
      class="px-3 py-2 flex items-center border-b border-[var(--p-divider-color)]"
    >
      <Button
        v-tooltip.bottom="$t('g.back')"
        icon="pi pi-arrow-left"
        text
        severity="secondary"
        @click="$emit('close')"
      />
      <span class="ml-2 font-semibold">{{ node.display_name }}</span>
    </div>
    <div class="p-4 flex-grow node-help-content max-w-[600px] mx-auto">
      <ProgressSpinner
        v-if="isLoading"
        class="m-auto"
        aria-label="Loading help"
      />
      <!-- Markdown fetched successfully -->
      <div
        v-else-if="!error"
        class="markdown-content"
        v-html="renderedHelpHtml"
      />
      <!-- Fallback: markdown not found or fetch error -->
      <div v-else class="text-sm space-y-6 fallback-content">
        <p v-if="node.description">
          <strong>{{ $t('g.description') }}:</strong> {{ node.description }}
        </p>

        <div v-if="inputList.length">
          <p>
            <strong>{{ $t('nodeHelpPage.inputs') }}:</strong>
          </p>
          <!-- Using plain HTML table instead of DataTable for consistent styling with markdown content -->
          <table>
            <thead>
              <tr>
                <th>{{ $t('g.name') }}</th>
                <th>{{ $t('nodeHelpPage.type') }}</th>
                <th>{{ $t('g.description') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="input in inputList" :key="input.name">
                <td>
                  <code>{{ input.name }}</code>
                </td>
                <td>{{ input.type }}</td>
                <td>{{ input.tooltip || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="outputList.length">
          <p>
            <strong>{{ $t('nodeHelpPage.outputs') }}:</strong>
          </p>
          <table>
            <thead>
              <tr>
                <th>{{ $t('g.name') }}</th>
                <th>{{ $t('nodeHelpPage.type') }}</th>
                <th>{{ $t('g.description') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="output in outputList" :key="output.name">
                <td>
                  <code>{{ output.name }}</code>
                </td>
                <td>{{ output.type }}</td>
                <td>{{ output.tooltip || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { computed } from 'vue'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'

const { node } = defineProps<{ node: ComfyNodeDefImpl }>()

const nodeHelpStore = useNodeHelpStore()
const { renderedHelpHtml, isLoading, error } = storeToRefs(nodeHelpStore)

defineEmits<{
  (e: 'close'): void
}>()

const inputList = computed(() =>
  Object.values(node.inputs).map((spec) => ({
    name: spec.name,
    type: spec.type,
    tooltip: spec.tooltip || ''
  }))
)

const outputList = computed(() =>
  node.outputs.map((spec) => ({
    name: spec.name,
    type: spec.type,
    tooltip: spec.tooltip || ''
  }))
)
</script>

<style scoped lang="postcss">
.node-help-content :deep(:is(img, video)) {
  @apply max-w-full h-auto block mb-4;
}

.markdown-content,
.fallback-content {
  @apply text-sm;
}

.markdown-content :deep(h1),
.fallback-content h1 {
  @apply text-[22px] font-bold mt-8 mb-4 first:mt-0;
}

.markdown-content :deep(h2),
.fallback-content h2 {
  @apply text-[18px] font-bold mt-8 mb-4 first:mt-0;
}

.markdown-content :deep(h3),
.fallback-content h3 {
  @apply text-[16px] font-bold mt-8 mb-4 first:mt-0;
}

.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6),
.fallback-content h4,
.fallback-content h5,
.fallback-content h6 {
  @apply mt-8 mb-4 first:mt-0;
}

.markdown-content :deep(td),
.fallback-content td {
  color: var(--drag-text);
}

.markdown-content :deep(a),
.fallback-content a {
  color: var(--drag-text);
  text-decoration: underline;
}

.markdown-content :deep(th),
.fallback-content th {
  color: var(--fg-color);
}

.markdown-content :deep(ul),
.markdown-content :deep(ol),
.fallback-content ul,
.fallback-content ol {
  @apply pl-8 my-2;
}

.markdown-content :deep(ul ul),
.markdown-content :deep(ol ol),
.markdown-content :deep(ul ol),
.markdown-content :deep(ol ul),
.fallback-content ul ul,
.fallback-content ol ol,
.fallback-content ul ol,
.fallback-content ol ul {
  @apply pl-6 my-2;
}

.markdown-content :deep(li),
.fallback-content li {
  @apply my-1;
}

.markdown-content :deep(*:first-child),
.fallback-content > *:first-child {
  @apply mt-0;
}

.markdown-content :deep(code),
.fallback-content code {
  @apply text-[var(--error-text)] bg-[var(--content-bg)] rounded px-1 py-0.5;
}

.markdown-content :deep(table),
.fallback-content table {
  @apply w-full border-collapse;
}

.markdown-content :deep(th),
.markdown-content :deep(td),
.fallback-content th,
.fallback-content td {
  @apply px-2 py-2;
}

.markdown-content :deep(tr),
.fallback-content tr {
  border-bottom: 1px solid var(--content-bg);
}

.markdown-content :deep(tr:last-child),
.fallback-content tr:last-child {
  border-bottom: none;
}

.markdown-content :deep(thead),
.fallback-content thead {
  border-bottom: 1px solid var(--p-text-color);
}
</style>
