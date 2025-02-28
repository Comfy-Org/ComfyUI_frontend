<template>
  <Form
    v-slot="$form"
    :resolver="zodResolver(zModelFile)"
    :initial-values="node.properties?.models?.[index]"
    @submit="handleSubmit"
  >
    <div class="flex flex-col gap-2">
      <div class="p-2 surface-ground rounded-lg">
        <Message
          v-if="$form.name?.error || $form.directory?.error"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ $form.name?.error?.message || $form.directory?.error?.message }}
        </Message>
        <div class="flex flex-col gap-2">
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-file" />
            </InputGroupAddon>
            <FormField v-slot="$field" name="name">
              <IftaLabel>
                <InputText
                  v-bind="$field"
                  :inputId="`model-name-${index}`"
                  class="h-full"
                />
                <label :for="`model-name-${index}`">
                  {{ $t('nodeMetadata.models.fields.filename') }}
                </label>
              </IftaLabel>
            </FormField>
          </InputGroup>
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-folder" />
            </InputGroupAddon>
            <FormField v-slot="$field" name="directory">
              <IftaLabel>
                <InputText
                  v-bind="$field"
                  :inputId="`model-directory-${index}`"
                  class="h-full"
                />
                <label :for="`model-directory-${index}`">
                  {{ $t('nodeMetadata.models.fields.directory') }}
                </label>
              </IftaLabel>
            </FormField>
          </InputGroup>
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-link" />
            </InputGroupAddon>
            <FormField v-slot="$field" name="url">
              <IftaLabel>
                <InputText v-bind="$field" :inputId="`model-url-${index}`" />
                <label :for="`model-url-${index}`">
                  {{ $t('nodeMetadata.models.fields.url') }}
                </label>
              </IftaLabel>
            </FormField>
          </InputGroup>
          <Message
            v-if="$form.url?.error"
            severity="error"
            size="small"
            variant="simple"
          >
            {{ $form.url?.error?.message }}
          </Message>
        </div>
      </div>
      <div class="flex items-center">
        <div class="flex-1 flex justify-center gap-2">
          <Button
            v-tooltip="$t('nodeMetadata.models.remove')"
            icon="pi pi-minus"
            severity="danger"
            text
            size="small"
            @click="emit('remove')"
          />
          <Button
            v-if="isLast"
            v-tooltip="$t('nodeMetadata.models.add')"
            icon="pi pi-plus"
            text
            size="small"
            @click="emit('add')"
          />
          <Button
            icon="pi pi-check"
            severity="primary"
            size="small"
            :disabled="!$form.valid"
            type="submit"
          />
        </div>
      </div>
    </div>
  </Form>
</template>

<script setup lang="ts">
import { Form, FormField } from '@primevue/forms'
// @ts-expect-error https://github.com/primefaces/primevue/issues/6722
import { zodResolver } from '@primevue/forms/resolvers/zod'
import { InputGroup } from 'primevue'
import Button from 'primevue/button'
import IftaLabel from 'primevue/iftalabel'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { type ModelFile, zModelFile } from '@/schemas/comfyWorkflowSchema'
import { app } from '@/scripts/app'

const toast = useToast()
const { t } = useI18n()

const { nodeId, index } = defineProps<{
  index: number
  isLast: boolean
  nodeId: string | number
}>()

const emit = defineEmits<{
  (e: 'remove'): void
  (e: 'add'): void
}>()

const node = computed(() => app.graph.getNodeById(nodeId))

const handleSubmit = (event: { values: ModelFile; valid: boolean }) => {
  if (!event.valid) return

  node.value.properties ||= {}
  node.value.properties.models ||= []
  node.value.properties.models[index] = event.values

  toast.add({
    severity: 'success',
    summary: t('nodeMetadata.models.success'),
    life: 3000
  })
}
</script>
