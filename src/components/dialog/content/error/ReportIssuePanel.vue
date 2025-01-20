<template>
  <Panel>
    <template #header>
      <div class="flex items-center gap-2">
        <span class="font-bold">{{ title }}</span>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <Button
          v-tooltip="$t('g.reportIssueTooltip')"
          :label="submitted ? $t('g.reportSent') : $t('g.reportIssue')"
          :severity="isButtonDisabled ? 'secondary' : 'primary'"
          :icon="icon"
          :disabled="isButtonDisabled"
          @click="reportIssue"
        />
      </div>
    </template>
    <div class="p-4 mt-4 border border-round surface-border shadow-1">
      <CheckboxGroup
        v-if="reportCheckboxes.length"
        v-model="selection"
        class="gap-4 mb-4"
        :checkboxes="reportCheckboxes"
      />
      <div class="mb-4">
        <InputText
          v-model="contactInfo"
          class="w-full"
          :placeholder="$t('issueReport.provideEmail')"
          :maxlength="CONTACT_MAX_LEN"
          :invalid="isContactInfoInvalid"
        />
        <CheckboxGroup
          v-model="contactPrefs"
          class="gap-3 mt-2"
          :checkboxes="contactCheckboxes"
        />
      </div>
      <div class="mb-4">
        <Textarea
          v-model="details"
          class="w-full"
          rows="4"
          :maxlength="DETAILS_MAX_LEN"
          :placeholder="$t('issueReport.provideAdditionalDetails')"
          :aria-label="$t('issueReport.provideAdditionalDetails')"
        />
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import type { CaptureContext, User } from '@sentry/core'
import { captureMessage } from '@sentry/core'
import cloneDeep from 'lodash/cloneDeep'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Panel from 'primevue/panel'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import CheckboxGroup from '@/components/common/CheckboxGroup.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type {
  DefaultField,
  IssueReportPanelProps
} from '@/types/issueReportTypes'

const ISSUE_NAME = 'User reported issue'
const DETAILS_MAX_LEN = 5_000
const CONTACT_MAX_LEN = 320

const props = defineProps<IssueReportPanelProps>()

const {
  defaultFields = ['Workflow', 'Logs', 'SystemStats', 'Settings'],
  tags = {}
} = props

const { t } = useI18n()
const toast = useToast()

const selection = ref<string[]>([])
const contactPrefs = ref<string[]>([])
const contactInfo = ref('')
const details = ref('')
const submitting = ref(false)
const submitted = ref(false)

const followUp = computed(() => contactPrefs.value.includes('FollowUp'))
const notifyResolve = computed(() => contactPrefs.value.includes('Resolution'))

const icon = computed(() => {
  if (submitting.value) return 'pi pi-spin pi-spinner'
  if (submitted.value) return 'pi pi-check'
  return 'pi pi-send'
})
const isFormEmpty = computed(() => !selection.value.length && !details.value)
const isContactInfoInvalid = computed(() => {
  if (!contactInfo.value) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return !emailRegex.test(contactInfo.value)
})
const isButtonDisabled = computed(
  () =>
    submitted.value ||
    submitting.value ||
    isFormEmpty.value ||
    isContactInfoInvalid.value
)

const contactCheckboxes = [
  { label: t('issueReport.contactFollowUp'), value: 'FollowUp' },
  { label: t('issueReport.notifyResolve'), value: 'Resolution' }
]
const defaultReportCheckboxes = [
  { label: t('g.workflow'), value: 'Workflow' },
  { label: t('g.logs'), value: 'Logs' },
  { label: t('issueReport.systemStats'), value: 'SystemStats' },
  { label: t('g.settings'), value: 'Settings' }
]
const reportCheckboxes = computed(() => [
  ...(props.extraFields
    ?.filter(({ optIn }) => optIn)
    .map(({ label, value }) => ({ label, value })) ?? []),
  ...defaultReportCheckboxes.filter(({ value }) =>
    defaultFields.includes(value as DefaultField)
  )
])

const getUserInfo = (): User => ({ email: contactInfo.value })

const getLogs = async () =>
  selection.value.includes('Logs') ? api.getLogs() : null

const getSystemStats = async () =>
  selection.value.includes('SystemStats') ? api.getSystemStats() : null

const getSettings = async () =>
  selection.value.includes('Settings') ? api.getSettings() : null

const getWorkflow = () =>
  selection.value.includes('Workflow')
    ? cloneDeep(app.graph.asSerialisable())
    : null

const createDefaultFields = async () => {
  const [settings, systemStats, logs, workflow] = await Promise.all([
    getSettings(),
    getSystemStats(),
    getLogs(),
    getWorkflow()
  ])
  return { settings, systemStats, logs, workflow }
}

const createExtraFields = (): Record<string, unknown> | undefined => {
  if (!props.extraFields) return undefined

  return props.extraFields
    .filter((field) => !field.optIn || selection.value.includes(field.value))
    .reduce((acc, field) => ({ ...acc, ...cloneDeep(field.data) }), {})
}

const createFeedback = () => {
  return {
    details: details.value,
    contactPreferences: {
      followUp: followUp.value,
      notifyOnResolution: notifyResolve.value
    }
  }
}

const createCaptureContext = async (): Promise<CaptureContext> => {
  return {
    user: getUserInfo(),
    level: 'error',
    tags: {
      errorType: props.errorType,
      ...tags
    },
    extra: {
      ...createFeedback(),
      ...(await createDefaultFields()),
      ...createExtraFields()
    }
  }
}

const reportIssue = async () => {
  if (isButtonDisabled.value) return

  submitting.value = true
  try {
    captureMessage(ISSUE_NAME, await createCaptureContext())
    submitted.value = true
    toast.add({
      severity: 'success',
      summary: t('g.reportSent'),
      life: 3000
    })
  } finally {
    submitting.value = false
  }
}
</script>
