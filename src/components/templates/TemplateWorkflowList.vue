<template>
  <DataTable
    v-model:selection="selectedTemplate"
    :value="enrichedTemplates"
    striped-rows
    selection-mode="single"
  >
    <Column field="title" :header="$t('g.title')">
      <template #body="slotProps">
        <span :title="slotProps.data.title">{{ slotProps.data.title }}</span>
      </template>
    </Column>
    <Column field="description" :header="$t('g.description')">
      <template #body="slotProps">
        <span :title="slotProps.data.description">
          {{ slotProps.data.description }}
        </span>
      </template>
    </Column>
    <Column field="actions" header="" class="w-12">
      <template #body="slotProps">
        <Button
          icon="pi pi-arrow-right"
          text
          rounded
          size="small"
          :loading="loading === slotProps.data.name"
          @click="emit('loadWorkflow', slotProps.data.name)"
        />
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import { computed, ref } from 'vue'

import { useTemplateWorkflows } from '@/composables/useTemplateWorkflows'
import type { TemplateInfo } from '@/types/workflowTemplateTypes'

const { sourceModule, loading, templates } = defineProps<{
  sourceModule: string
  categoryTitle: string
  loading: string | null
  templates: TemplateInfo[]
}>()

const selectedTemplate = ref(null)
const { getTemplateTitle, getTemplateDescription } = useTemplateWorkflows()

const enrichedTemplates = computed(() => {
  return templates.map((template) => {
    const actualSourceModule = template.sourceModule || sourceModule
    return {
      ...template,
      title: getTemplateTitle(template, actualSourceModule),
      description: getTemplateDescription(template, actualSourceModule)
    }
  })
})

const emit = defineEmits<{
  loadWorkflow: [name: string]
}>()
</script>
