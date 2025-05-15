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
    <div class="px-4 overflow-auto flex-grow node-help-content">
      <template v-if="node.help">
        <div class="text-sm" v-html="renderedHelpHtml" />
      </template>
      <div v-else class="text-sm space-y-6">
        <p>
          <strong>{{ $t('g.description') }}:</strong> {{ node.description }}
        </p>

        <div v-if="inputList.length">
          <p>
            <strong>{{ $t('nodeHelpPage.inputs') }}:</strong>
          </p>
          <DataTable
            :value="inputList"
            class="text-sm"
            table-style="min-width: 100%"
          >
            <Column field="name" :header="$t('g.name')">
              <template #body="slotProps">
                <code>{{ slotProps.data.name }}</code>
              </template>
            </Column>
            <Column field="type" :header="$t('nodeHelpPage.type')" />
            <Column field="tooltip" :header="$t('g.description')">
              <template #body="slotProps">
                {{ slotProps.data.tooltip || '-' }}
              </template>
            </Column>
          </DataTable>
        </div>

        <div v-if="outputList.length">
          <p>
            <strong>{{ $t('nodeHelpPage.outputs') }}:</strong>
          </p>
          <DataTable
            :value="outputList"
            class="text-sm"
            table-style="min-width: 100%"
          >
            <Column field="name" :header="$t('g.name')">
              <template #body="slotProps">
                <code>{{ slotProps.data.name }}</code>
              </template>
            </Column>
            <Column field="type" :header="$t('nodeHelpPage.type')" />
            <Column field="tooltip" :header="$t('g.description')">
              <template #body="slotProps">
                {{ slotProps.data.tooltip || '-' }}
              </template>
            </Column>
          </DataTable>
        </div>

        <p>
          {{ $t('nodeHelpPage.moreHelp') }}
          <a
            href="https://docs.comfy.org/"
            target="_blank"
            rel="noopener"
            class="text-blue-600 underline"
          >
            {{ $t('nodeHelpPage.documentationPage') }} </a
          >.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import { computed } from 'vue'

import { useNodeHelp } from '@/composables/useNodeHelp'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const { node } = defineProps<{ node: ComfyNodeDefImpl }>()

const { renderedHelpHtml } = useNodeHelp()

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
.node-help-content :is(img, video) {
  @apply max-w-full h-auto block mb-4;
}
</style>
