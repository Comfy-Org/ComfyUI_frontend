<template>
  <Form
    :id="isFirst ? 'node-models-form' : undefined"
    @submit="$emit('submit', $event)"
    :resolver="zodResolver(zModelFile)"
    :initial-values="model"
    v-slot="$form"
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
              <i class="pi pi-file-pdf" />
            </InputGroupAddon>
            <FormField v-slot="$field" name="name">
              <IftaLabel>
                <InputText
                  v-bind="$field"
                  :inputId="`model-name-${index}`"
                  class="h-full"
                />
                <label :for="`model-name-${index}`">
                  {{ $t('nodeMetadata.models.fields.name') }}
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
            @click="$emit('remove')"
          />
          <Button
            v-if="isLast"
            v-tooltip="$t('nodeMetadata.models.add')"
            icon="pi pi-plus"
            text
            size="small"
            @click="$emit('add')"
          />
        </div>
        <Button
          v-if="showSaveButton"
          type="submit"
          icon="pi pi-check"
          severity="primary"
          size="small"
          v-tooltip="$t('nodeMetadata.models.save')"
          form="node-models-form"
        />
      </div>
    </div>
  </Form>
</template>

<script setup lang="ts">
import { Form, FormField, type FormSubmitEvent } from '@primevue/forms'
// @ts-expect-error https://github.com/primefaces/primevue/issues/6722
import { zodResolver } from '@primevue/forms/resolvers/zod'
import { InputGroup } from 'primevue'
import Button from 'primevue/button'
import IftaLabel from 'primevue/iftalabel'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'

import { type ModelFile, zModelFile } from '@/schemas/comfyWorkflowSchema'

defineProps<{
  model: ModelFile
  index: number
  isFirst: boolean
  isLast: boolean
  showSaveButton: boolean
}>()

defineEmits<{
  (e: 'submit', event: FormSubmitEvent): void
  (e: 'remove'): void
  (e: 'add'): void
}>()
</script>
