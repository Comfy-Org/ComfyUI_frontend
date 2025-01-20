<template>
  <Form
    v-slot="$form"
    @submit="submit"
    :resolver="zodResolver(issueReportSchema)"
  >
    <Panel :pt="$attrs.pt">
      <template #header>
        <div class="flex items-center gap-2">
          <span class="font-bold">{{ title }}</span>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-4">
          <Button
            v-tooltip="!submitted ? $t('g.reportIssueTooltip') : undefined"
            :label="submitted ? $t('g.reportSent') : $t('g.reportIssue')"
            :severity="submitted ? 'secondary' : 'primary'"
            :icon="submitted ? 'pi pi-check' : 'pi pi-send'"
            :disabled="submitted"
            type="submit"
          />
        </div>
      </template>
      <div class="p-4 mt-2 border border-round surface-border shadow-1">
        <div class="flex flex-row gap-3 mb-2">
          <div v-for="field in fields" :key="field.value">
            <FormField
              v-if="field.optIn"
              v-slot="$field"
              :name="field.value"
              class="flex space-x-1"
            >
              <Checkbox
                v-bind="$field"
                :inputId="field.value"
                :value="field.value"
                v-model="selection"
              />
              <label :for="field.value">{{ field.label }}</label>
            </FormField>
          </div>
        </div>
        <FormField class="mb-4" v-slot="$field" name="details">
          <Textarea
            v-bind="$field"
            class="w-full"
            rows="5"
            :placeholder="$t('issueReport.provideAdditionalDetails')"
            :aria-label="$t('issueReport.provideAdditionalDetails')"
          />
          <Message
            v-if="$field?.error && $field.touched"
            severity="error"
            size="small"
            variant="simple"
          >
            {{ t('validation.maxLength') }}
          </Message>
        </FormField>
        <FormField v-slot="$field" name="contactInfo">
          <InputText
            v-bind="$field"
            class="w-full"
            :placeholder="$t('issueReport.provideEmail')"
          />
          <Message
            v-if="$field?.error && $field.touched"
            severity="error"
            size="small"
            variant="simple"
          >
            {{ t('validation.invalidEmail') }}
          </Message>
        </FormField>

        <div class="flex flex-row gap-3 mt-2">
          <div v-for="checkbox in contactCheckboxes" :key="checkbox.value">
            <FormField
              v-slot="$field"
              :name="checkbox.value"
              class="flex space-x-1"
            >
              <Checkbox
                v-bind="$field"
                :inputId="checkbox.value"
                :value="checkbox.value"
                v-model="contactPrefs"
                :disabled="
                  $form.contactInfo?.error || !$form.contactInfo?.value
                "
              />
              <label :for="checkbox.value">{{ checkbox.label }}</label>
            </FormField>
          </div>
        </div>
      </div>
    </Panel>
  </Form>
</template>

<script setup lang="ts">
import { Form, FormField, type FormSubmitEvent } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import type { CaptureContext, User } from '@sentry/core'
import { captureMessage } from '@sentry/core'
import cloneDeep from 'lodash/cloneDeep'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Panel from 'primevue/panel'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import {
  type IssueReportFormData,
  type ReportField,
  issueReportSchema
} from '@/types/issueReportTypes'
import type {
  DefaultField,
  IssueReportPanelProps
} from '@/types/issueReportTypes'
import { isElectron } from '@/utils/envUtil'

const ISSUE_NAME = 'User reported issue'

const props = defineProps<IssueReportPanelProps>()
const { defaultFields = ['Workflow', 'Logs', 'SystemStats', 'Settings'] } =
  props

const { t } = useI18n()
const toast = useToast()

const selection = ref<string[]>([])
const contactPrefs = ref<string[]>([])
const submitted = ref(false)

const contactCheckboxes = [
  { label: t('issueReport.contactFollowUp'), value: 'followUp' },
  { label: t('issueReport.notifyResolve'), value: 'notifyOnResolution' }
]

const defaultFieldsConfig: ReportField[] = [
  {
    label: t('issueReport.systemStats'),
    value: 'systemStats',
    getData: () => api.getSystemStats(),
    optIn: true
  },
  {
    label: t('g.workflow'),
    value: 'workflow',
    getData: () => app.graph.asSerialisable(),
    optIn: true
  },
  {
    label: t('g.logs'),
    value: 'logs',
    getData: () => api.getLogs(),
    optIn: true
  },
  {
    label: t('g.settings'),
    value: 'settings',
    getData: () => api.getSettings(),
    optIn: true
  }
]

const fields = computed(() => [
  ...defaultFieldsConfig.filter(({ value }) =>
    defaultFields.includes(value as DefaultField)
  ),
  ...props.extraFields
])

const createUser = (formData: IssueReportFormData): User => ({
  email: formData.contactInfo || undefined
})

const createExtraData = async (formData: IssueReportFormData) => {
  const result = {}
  const isChecked = (fieldValue: string) => formData[fieldValue]

  for (const field of fields.value) {
    if (!field.optIn || isChecked(field.value)) {
      const data = await field.getData()
      result[field.value] = data instanceof Object ? cloneDeep(data) : data
    }
  }

  return result
}

const createCaptureContext = async (
  formData: IssueReportFormData
): Promise<CaptureContext> => {
  return {
    user: createUser(formData),
    level: 'error',
    tags: {
      errorType: props.errorType,
      followUp: formData.contactInfo && formData.followUp,
      notifyOnResolution: formData.contactInfo && formData.notifyOnResolution,
      isElectron: isElectron(),
      ...props.tags
    },
    extra: {
      details: formData.details,
      ...(await createExtraData(formData))
    }
  }
}

const submit = async (event: FormSubmitEvent) => {
  if (event.valid) {
    try {
      const captureContext = await createCaptureContext(event.values)
      captureMessage(ISSUE_NAME, captureContext)
      submitted.value = true
      toast.add({
        severity: 'success',
        summary: t('g.reportSent'),
        life: 3000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: error.message,
        life: 3000
      })
    }
  }
}
</script>
