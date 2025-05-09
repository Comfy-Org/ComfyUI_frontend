<template>
  <DataTable
    v-model:selection="selectedTemplate"
    :value="templates"
    striped-rows
    selection-mode="single"
  >
    <Column field="title" :header="$t('g.title')">
      <template #body="slotProps">
        <span :title="getTemplateTitle(slotProps.data)">{{
          getTemplateTitle(slotProps.data)
        }}</span>
      </template>
    </Column>
    <Column field="description" :header="$t('g.description')">
      <template #body="slotProps">
        <span :title="getTemplateDescription(slotProps.data)">
          {{ getTemplateDescription(slotProps.data) }}
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
import { ref } from 'vue'

import type { TemplateInfo } from '@/types/workflowTemplateTypes'

const { sourceModule, loading, templates } = defineProps<{
  sourceModule: string
  categoryTitle: string
  loading: string | null
  templates: TemplateInfo[]
}>()

const selectedTemplate = ref(null)

const emit = defineEmits<{
  loadWorkflow: [name: string]
}>()

const getTemplateTitle = (template: TemplateInfo) => {
  const fallback = template.title ?? template.name ?? `${sourceModule} Template`
  return sourceModule === 'default'
    ? template.localizedTitle ?? fallback
    : fallback
}

const getTemplateDescription = (template: TemplateInfo) => {
  return sourceModule === 'default'
    ? template.localizedDescription ?? ''
    : template.description.replace(/[-_]/g, ' ').trim()
}
</script>
