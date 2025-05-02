<template>
  <div class="flex flex-col h-full">
    <DataTable
      v-model:selection="selectedTemplate"
      :value="templates"
      class="w-full flex-1"
      data-testid="template-workflow-list"
      :paginator="templates.length > 10"
      :rows="10"
      :rows-per-page-options="[5, 10, 20]"
      striped-rows
      selection-mode="single"
      :pt="{
        root: { class: 'flex flex-col h-full' },
        wrapper: { class: 'flex-1 overflow-auto' },
        table: { class: 'table-fixed' },
        footer: { class: 'mt-auto' }
      }"
      scrollable
      scroll-height="flex"
      @row-select="onTemplateSelect"
    >
      <Column field="title" header="Title">
        <template #body="slotProps">
          <span :title="getTemplateTitle(slotProps.data)">{{
            getTemplateTitle(slotProps.data)
          }}</span>
        </template>
      </Column>
      <Column field="description" header="Description">
        <template #body="slotProps">
          <span :title="slotProps.data.description.replace(/[-_]/g, ' ')">
            {{ slotProps.data.description.replace(/[-_]/g, ' ') }}
          </span>
        </template>
      </Column>
      <Column field="actions" header="" :style="{ width: '5rem' }">
        <template #body="slotProps">
          <Button
            icon="pi pi-arrow-right"
            text
            rounded
            class="p-button-sm"
            :loading="loading === slotProps.data.name"
            @click="$emit('loadWorkflow', slotProps.data.name)"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import { ref } from 'vue'

import { st } from '@/i18n'
import { TemplateInfo } from '@/types/workflowTemplateTypes'
import { normalizeI18nKey } from '@/utils/formatUtil'

const { sourceModule, categoryTitle, loading, templates } = defineProps<{
  sourceModule: string
  categoryTitle: string
  loading: string | null
  templates: TemplateInfo[]
}>()

const selectedTemplate = ref(null)

const emit = defineEmits<{
  loadWorkflow: [name: string]
}>()

const onTemplateSelect = (event: any) => {
  if (event.data) {
    emit('loadWorkflow', event.data.name)
  }
}

const getTemplateTitle = (template: TemplateInfo) => {
  const fallback = template.title ?? template.name ?? `${sourceModule} Template`
  return sourceModule === 'default'
    ? st(
        `templateWorkflows.template.${normalizeI18nKey(categoryTitle)}.${normalizeI18nKey(template.name)}`,
        fallback
      )
    : fallback
}
</script>

<style scoped>
:deep(.p-paginator) {
  margin-top: auto;
}

:deep(.p-datatable-tbody > tr) {
  height: 3rem;
}

:deep(.p-datatable-wrapper) {
  min-height: 30rem;
}

:deep(.p-datatable-tbody > tr > td) {
  padding: 0.75rem 1rem;
  vertical-align: middle;
}
</style>
