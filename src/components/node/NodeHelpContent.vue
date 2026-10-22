<template>
  <div class="node-help-content mx-auto w-full">
    <AppSpinner v-if="isLoading" class="m-auto" />
    <SanitizedHtml
      v-else-if="!error"
      class="comfy-markdown-content overflow-visible [--comfy-markdown-font-size:var(--text-sm)] [&_table]:block [&_table]:overflow-x-auto"
      :html="renderedHelpHtml"
    />
    <div
      v-else
      class="comfy-markdown-content space-y-6 [--comfy-markdown-font-size:var(--text-sm)]"
    >
      <p v-if="node.description">
        <strong>{{ $t('g.description') }}:</strong> {{ node.description }}
      </p>

      <div v-if="inputList.length">
        <p>
          <strong>{{ $t('nodeHelpPage.inputs') }}:</strong>
        </p>
        <div class="overflow-x-auto">
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
      </div>

      <div v-if="outputList.length">
        <p>
          <strong>{{ $t('nodeHelpPage.outputs') }}:</strong>
        </p>
        <div class="overflow-x-auto">
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
import { computed } from 'vue'

import SanitizedHtml from '@/components/common/SanitizedHtml.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'
import { useNodeHelpContent } from '@/composables/useNodeHelpContent'
import { flattenInputSpecs } from '@/schemas/nodeDef/inputSpecUtil'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'

const { node } = defineProps<{
  node: ComfyNodeDefImpl
}>()

const { renderedHelpHtml, isLoading, error } = useNodeHelpContent(() => node)

const inputList = computed(() =>
  flattenInputSpecs(node.inputs).map((spec) => ({
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
