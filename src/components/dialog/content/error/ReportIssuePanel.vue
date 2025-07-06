<template>
  <Form
    v-slot="$form"
    :resolver="zodResolver(issueReportSchema)"
    @submit="submit"
  >
    <Panel :pt="$attrs.pt as any">
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
        <div class="flex flex-col gap-6">
          <FormField
            v-slot="$field"
            name="contactInfo"
            :initial-value="authStore.currentUser?.email"
          >
            <div class="self-stretch inline-flex justify-start items-center">
              <label for="contactInfo" class="pb-2 pt-0 opacity-80">{{
                $t('issueReport.email')
              }}</label>
            </div>
            <InputText
              id="contactInfo"
              v-bind="$field"
              class="w-full"
              :placeholder="$t('issueReport.provideEmail')"
            />
            <Message
              v-if="$field?.error && $field.touched && $field.value !== ''"
              severity="error"
              size="small"
              variant="simple"
            >
              {{ t('issueReport.validation.invalidEmail') }}
            </Message>
          </FormField>

          <FormField v-slot="$field" name="helpType">
            <div class="flex flex-col gap-2">
              <div
                class="self-stretch inline-flex justify-start items-center gap-2.5"
              >
                <label for="helpType" class="pb-2 pt-0 opacity-80">{{
                  $t('issueReport.whatDoYouNeedHelpWith')
                }}</label>
              </div>
              <Dropdown
                v-bind="$field"
                v-model="$field.value"
                :options="helpTypes"
                option-label="label"
                option-value="value"
                :placeholder="$t('issueReport.selectIssue')"
                class="w-full"
              />
              <Message
                v-if="$field?.error"
                severity="error"
                size="small"
                variant="simple"
              >
                {{ t('issueReport.validation.selectIssueType') }}
              </Message>
            </div>
          </FormField>

          <div class="flex flex-col gap-2">
            <div
              class="self-stretch inline-flex justify-start items-center gap-2.5"
            >
              <span class="pb-2 pt-0 opacity-80">{{
                $t('issueReport.whatCanWeInclude')
              }}</span>
            </div>
            <div class="flex flex-row gap-3">
              <div v-for="field in fields" :key="field.value">
                <FormField
                  v-if="field.optIn"
                  v-slot="$field"
                  :name="field.value"
                  class="flex space-x-1"
                >
                  <Checkbox
                    v-bind="$field"
                    v-model="selection"
                    :input-id="field.value"
                    :value="field.value"
                  />
                  <label :for="field.value">{{ field.label }}</label>
                </FormField>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <FormField v-slot="$field" name="details">
              <div
                class="self-stretch inline-flex justify-start items-center gap-2.5"
              >
                <label for="details" class="pb-2 pt-0 opacity-80">{{
                  $t('issueReport.describeTheProblem')
                }}</label>
              </div>
              <Textarea
                v-bind="$field"
                id="details"
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
                {{
                  $field.value
                    ? t('issueReport.validation.maxLength')
                    : t('issueReport.validation.descriptionRequired')
                }}
              </Message>
            </FormField>
          </div>

          <div class="flex flex-col gap-3 mt-2">
            <div v-for="checkbox in contactCheckboxes" :key="checkbox.value">
              <FormField
                v-slot="$field"
                :name="checkbox.value"
                class="flex space-x-1"
              >
                <Checkbox
                  v-bind="$field"
                  v-model="contactPrefs"
                  :input-id="checkbox.value"
                  :value="checkbox.value"
                  :disabled="
                    $form.contactInfo?.error || !$form.contactInfo?.value
                  "
                />
                <label :for="checkbox.value">{{ checkbox.label }}</label>
              </FormField>
            </div>
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
import _ from 'lodash'
import cloneDeep from 'lodash/cloneDeep'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Panel from 'primevue/panel'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  type IssueReportFormData,
  issueReportSchema
} from '@/schemas/issueReportSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import type {
  DefaultField,
  IssueReportPanelProps,
  ReportField
} from '@/types/issueReportTypes'
import { isElectron } from '@/utils/envUtil'
import { generateUUID } from '@/utils/formatUtil'

const DEFAULT_ISSUE_NAME = 'User reported issue'

const props = defineProps<IssueReportPanelProps>()
const { defaultFields = ['Workflow', 'Logs', 'SystemStats', 'Settings'] } =
  props

const { t } = useI18n()
const toast = useToast()
const authStore = useFirebaseAuthStore()

const selection = ref<string[]>([])
const contactPrefs = ref<string[]>([])
const submitted = ref(false)

const contactCheckboxes = [
  { label: t('issueReport.contactFollowUp'), value: 'followUp' },
  { label: t('issueReport.notifyResolve'), value: 'notifyOnResolution' }
]

const helpTypes = [
  {
    label: t('issueReport.helpTypes.billingPayments'),
    value: 'billingPayments'
  },
  {
    label: t('issueReport.helpTypes.loginAccessIssues'),
    value: 'loginAccessIssues'
  },
  { label: t('issueReport.helpTypes.giveFeedback'), value: 'giveFeedback' },
  { label: t('issueReport.helpTypes.bugReport'), value: 'bugReport' },
  { label: t('issueReport.helpTypes.somethingElse'), value: 'somethingElse' }
]

const defaultFieldsConfig: ReportField[] = [
  {
    label: t('issueReport.systemStats'),
    value: 'SystemStats',
    getData: () => api.getSystemStats(),
    optIn: true
  },
  {
    label: t('g.workflow'),
    value: 'Workflow',
    getData: () => cloneDeep(app.graph.asSerialisable()),
    optIn: true
  },
  {
    label: t('g.logs'),
    value: 'Logs',
    getData: () => api.getLogs(),
    optIn: true
  },
  {
    label: t('g.settings'),
    value: 'Settings',
    getData: () => api.getSettings(),
    optIn: true
  }
]

const fields = computed(() => [
  ...defaultFieldsConfig.filter(({ value }) =>
    defaultFields.includes(value as DefaultField)
  ),
  ...(props.extraFields ?? [])
])

const createUser = (formData: IssueReportFormData): User => ({
  email: formData.contactInfo || undefined
})

const createExtraData = async (formData: IssueReportFormData) => {
  const result: Record<string, unknown> = {}
  const isChecked = (fieldValue: string) => formData[fieldValue]

  await Promise.all(
    fields.value
      .filter((field) => !field.optIn || isChecked(field.value))
      .map(async (field) => {
        try {
          result[field.value] = await field.getData()
        } catch (error) {
          console.error(`Failed to collect ${field.value}:`, error)
          result[field.value] = { error: String(error) }
        }
      })
  )

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
      helpType: formData.helpType,
      followUp: formData.contactInfo ? formData.followUp : false,
      notifyOnResolution: formData.contactInfo
        ? formData.notifyOnResolution
        : false,
      isElectron: isElectron(),
      ..._.mapValues(props.tags, (tag) => _.trim(tag).replace(/[\n\r\t]/g, ' '))
    },
    extra: {
      details: formData.details,
      ...(await createExtraData(formData))
    }
  }
}

const generateUniqueTicketId = (type: string) => `${type}-${generateUUID()}`

const submit = async (event: FormSubmitEvent) => {
  if (event.valid) {
    try {
      const captureContext = await createCaptureContext(event.values)

      // If it's billing or access issue, generate unique id to be used by customer service ticketing
      const isValidContactInfo = event.values.contactInfo?.length
      const isCustomerServiceIssue =
        isValidContactInfo &&
        ['billingPayments', 'loginAccessIssues'].includes(
          event.values.helpType || ''
        )
      const issueName = isCustomerServiceIssue
        ? `ticket-${generateUniqueTicketId(event.values.helpType || '')}`
        : DEFAULT_ISSUE_NAME
      captureMessage(issueName, captureContext)
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
        detail: error instanceof Error ? error.message : String(error),
        life: 3000
      })
    }
  }
}
</script>
