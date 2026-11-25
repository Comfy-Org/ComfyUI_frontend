<template>
  <MissingModelsCard
    v-if="state.kind === 'missingModels'"
    :models="state.models"
    :signed-in="isLoggedIn"
    :recovering="!!uploadModels"
    @dismiss="emit('dismiss')"
    @sign-in="emit('signInToUpload')"
  />
  <DeploySetupCard
    v-else-if="state.kind === 'deploySetup'"
    :body="$t('openOnCloud.deploySetupDialog.missingNodesBody')"
    :video-sources="DEPLOY_VIDEO_SOURCES"
    :poster-src="DEPLOY_VIDEO_POSTER_SRC"
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
  <RunOnCloudCard
    v-else-if="state.kind === 'ready' || !uploadBatch"
    :asks-to-sign-in="state.kind === 'ready' ? state.asksToSignIn : !isLoggedIn"
    :workspace-id="state.kind === 'ready' ? state.workspaceId : undefined"
    :unchecked-inputs="
      state.kind === 'ready' ? state.uncheckedInputs : undefined
    "
    :needs-consent="state.kind !== 'ready'"
    :checking="state.kind === 'checking' && (!requestCheck || checkRequested)"
    @check="startCheck"
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
</template>

<script setup lang="ts">
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { RunOnCloudTelemetryEvent } from '@comfyorg/telemetry/types'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

import DeploySetupCard from '@/platform/openOnCloud/components/DeploySetupCard.vue'
import RunOnCloudCard from '@/platform/openOnCloud/components/RunOnCloudCard.vue'
import MissingModelsCard from '@/platform/openOnCloud/components/MissingModelsCard.vue'
import type { RunOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { runOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useLocalModelUploadStore } from '@/platform/openOnCloud/stores/localModelUploadStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { MissingModel } from '@/platform/openOnCloud/stores/localModelUploadStore'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'

const { uploadBatch, requestCheck } = defineProps<{
  uploadBatch?: { models: MissingModel[]; owner: string }
  requestCheck?: (signal: AbortSignal) => boolean
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
  signInToUpload: []
}>()

const checkRequested = ref(false)
const checkConsent = new AbortController()
onBeforeUnmount(() => checkConsent.abort())

const settingStore = useSettingStore()

function startCheck(dontAskAgain = false) {
  if (checkRequested.value || !requestCheck?.(checkConsent.signal)) return
  checkRequested.value = true
  if (dontAskAgain)
    settingStore
      .set('Comfy.Cloud.AskBeforeCompatibilityCheck', false)
      .catch((cause: unknown) =>
        reportError(cause, {
          surface: 'platform',
          errorType: 'error_saving_cloud_check_consent',
          level: 'warning'
        })
      )
}

onMounted(() => {
  if (settingStore.get('Comfy.Cloud.AskBeforeCompatibilityCheck') === false)
    startCheck()
})

const { state: check } = storeToRefs(useCloudWorkflowCheckStore())
const uploads = useLocalModelUploadStore()
const { activeModels, isUploading, owner, retryBatches } = storeToRefs(uploads)
const { isLoggedIn } = useCurrentUser()
const { flags } = useFeatureFlags()
const uploadModels = computed(() => {
  if (uploadBatch && uploadBatch.owner !== owner.value) return
  if (isUploading.value) return activeModels.value
  const models = uploadBatch && toRaw(uploadBatch.models)
  if (
    models &&
    (flags.openOnCloudModelUploadEnabled || uploads.canFinish(models)) &&
    (activeModels.value === models || retryBatches.value.includes(models))
  )
    return models
})
const state = computed(() => {
  if (uploadModels.value)
    return { kind: 'missingModels' as const, models: uploadModels.value }
  if (uploadBatch || (requestCheck && !checkRequested.value))
    return { kind: 'checking' as const }
  return runOnCloudModalState(check.value, { signedIn: isLoggedIn.value })
})
watch([owner, uploadModels], ([currentOwner, models]) => {
  if (uploadBatch && (uploadBatch.owner !== currentOwner || !models))
    emit('dismiss')
})

function dialogShownEvent(
  shown: Exclude<RunOnCloudModalState, { kind: 'checking' }>
): RunOnCloudTelemetryEvent {
  const name = 'app:run_on_cloud_dialog_shown'
  const source = 'cloud_button'
  switch (shown.kind) {
    case 'ready':
      return {
        name,
        properties: {
          state: 'ready',
          source,
          asks_to_sign_in: shown.asksToSignIn,
          unchecked_input_count: shown.uncheckedInputs.length
        }
      }
    case 'deploySetup':
      return { name, properties: { state: 'deploy_setup', source } }
    case 'missingModels':
      return {
        name,
        properties: {
          state: 'missing_models',
          source,
          missing_model_count: shown.models.length
        }
      }
  }
}

watch(
  state,
  (shown) => {
    if (shown.kind === 'checking') return
    useTelemetry()?.trackRunOnCloudEvent(dialogShownEvent(shown))
  },
  { immediate: true }
)
</script>
