<template>
  <div class="flex flex-col h-full bg-[var(--p-tree-background)]">
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
    <div class="px-4 overflow-auto flex-grow">
      <template v-if="node.help">
        <MarkdownRenderer class="text-sm" :content="node.help" />
      </template>
      <div v-else class="text-sm space-y-6">
        <p><strong>Description:</strong> {{ node.description }}</p>

        <div v-if="inputList.length">
          <p><strong>Inputs:</strong></p>
          <table class="min-w-full table-auto text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left">Name</th>
                <th class="px-4 py-2 text-left">Type</th>
                <th class="px-4 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="input in inputList" :key="input.name">
                <td class="border px-4 py-2">
                  <code>{{ input.name }}</code>
                </td>
                <td class="border px-4 py-2">{{ input.type }}</td>
                <td class="border px-4 py-2">{{ input.tooltip || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="outputList.length">
          <p><strong>Outputs:</strong></p>
          <table class="min-w-full table-auto text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left">Name</th>
                <th class="px-4 py-2 text-left">Type</th>
                <th class="px-4 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="output in outputList" :key="output.name">
                <td class="border px-4 py-2">
                  <code>{{ output.name }}</code>
                </td>
                <td class="border px-4 py-2">{{ output.type }}</td>
                <td class="border px-4 py-2">{{ output.tooltip || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          For more help, visit the
          <a
            href="https://docs.comfy.org/"
            target="_blank"
            rel="noopener"
            class="text-blue-600 underline"
          >
            documentation page</a
          >.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const { node } = defineProps<{
  node: ComfyNodeDefImpl
}>()

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
