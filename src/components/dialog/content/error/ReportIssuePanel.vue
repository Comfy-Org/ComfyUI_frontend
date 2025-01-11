<template>
  <Panel>
    <template #header>
      <div class="flex items-center gap-2">
        <span class="font-bold">{{ $t('g.submitErrorReport') }}</span>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <Button
          v-tooltip="$t('g.reportIssueTooltip')"
          @click="reportIssue"
          :label="$t('g.reportIssue')"
          :severity="submitted ? 'secondary' : 'primary'"
          :icon="icon"
          :disabled="submitted"
        />
      </div>
    </template>
    <div class="p-4 mt-4 border border-round surface-border shadow-1">
      <CheckboxGroup
        v-model="selection"
        :checkboxes="reportCheckboxes"
        class="gap-4 mb-4"
      />
      <div class="mb-4">
        <InputText
          v-model="contactInfo"
          :placeholder="$t('g.provideEmail')"
          class="w-full"
        />
        <CheckboxGroup
          v-model="contactPreferences"
          :checkboxes="contactCheckboxes"
          class="gap-3 mt-2"
        />
      </div>
      <div class="mb-4">
        <Textarea
          v-model="additionalDetails"
          rows="4"
          :placeholder="$t('g.provideAdditionalDetails')"
          class="w-full"
        />
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { SerialisableGraph } from '@comfyorg/litegraph'
import type { CaptureContext, User } from '@sentry/core'
import { captureMessage } from '@sentry/vue'
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
  ExecutionErrorWsMessage,
  Settings,
  SystemStats
} from '@/types/apiTypes'

const ISSUE_NAME = 'User reported issue'

const { error } = defineProps<{
  error: ExecutionErrorWsMessage
}>()

const { t } = useI18n()
const toast = useToast()

const selection = ref<string[]>(['Stacktrace'])
const contactPreferences = ref<string[]>([])
const contactInfo = ref('')
const additionalDetails = ref('')
const submitting = ref(false)
const submitted = ref(false)

const reportCheckboxes = [
  { label: t('g.stackTrace'), value: 'Stacktrace' },
  { label: t('g.workflow'), value: 'Workflow' },
  { label: t('g.logs'), value: 'Logs' },
  { label: t('g.systemStats'), value: 'SystemStats' },
  { label: t('g.settings'), value: 'Settings' }
]
const contactCheckboxes = [
  {
    label: t('g.contactForFollowUp'),
    value: 'FollowUp'
  },
  {
    label: t('g.notifyOnResolution'),
    value: 'Resolution'
  }
]

const followUp = computed(() => contactPreferences.value.includes('FollowUp'))
const notifyOnResolution = computed(() =>
  contactPreferences.value.includes('Resolution')
)

const icon = computed(
  () => `pi ${submitting.value ? 'pi-spin pi-spinner' : 'pi-send'}`
)

const getUserInfo = (): User => ({ email: contactInfo.value })

const getLogs = async (): Promise<string | null> =>
  selection.value.includes('Logs') ? api.getLogs() : null

const getSystemStats = async (): Promise<SystemStats | null> =>
  selection.value.includes('SystemStats') ? api.getSystemStats() : null

const getSettings = async (): Promise<Settings | null> =>
  selection.value.includes('Settings') ? api.getSettings() : null

const getWorkflow = (): SerialisableGraph | null =>
  selection.value.includes('Workflow')
    ? cloneDeep(app.graph.asSerialisable())
    : null

const createMessageDetails = async () => {
  return {
    nodeType: error.node_type,
    stackTrace: error.traceback?.join('\n'),
    details: additionalDetails.value.toString(),
    settings: await getSettings(),
    systemStats: await getSystemStats(),
    logs: await getLogs(),
    workflow: getWorkflow(),
    contactPreferences: {
      followUp: followUp.value,
      notifyOnResolution: notifyOnResolution.value
    }
  }
}

const createCaptureContext = async (): Promise<CaptureContext> => {
  return {
    user: getUserInfo(),
    level: 'error',
    tags: {
      comfyUIExecutionError: true
    },
    extra: await createMessageDetails()
  }
}

const reportIssue = async () => {
  if (submitting.value) return
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
