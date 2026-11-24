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
    :video-sources="DEPLOY_VIDEO_SOURCES"
    :poster-src="DEPLOY_VIDEO_POSTER_SRC"
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
  <RunOnCloudCard
    v-else-if="state.kind === 'ready'"
    :asks-to-sign-in="state.asksToSignIn"
    :workspace-id="state.workspaceId"
    :unchecked-inputs="state.uncheckedInputs"
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
  <DeploymentDialogFrame
    v-else-if="requestCheck && !uploadBatch"
    @dismiss="emit('dismiss')"
  >
    <section class="flex flex-col gap-4 px-9 pt-9 pb-8">
      <DialogTitle class="my-0 pr-8 text-2xl/8 font-bold tracking-tight">
        {{ $t('openOnCloud.cloudButton.tooltip') }}
      </DialogTitle>
      <DialogDescription class="my-0 text-sm/5 whitespace-pre-line">
        {{ $t('openOnCloud.cloudButton.checkDisclosure') }}
      </DialogDescription>
      <footer class="flex flex-wrap items-center justify-end gap-2.5 pt-3">
        <Button variant="secondary" size="lg" @click="emit('dismiss')">
          {{ $t('g.cancel') }}
        </Button>
        <Button
          variant="primary"
          size="lg"
          :disabled="checkRequested"
          @click="startCheck"
        >
          {{
            checkRequested
              ? $t('openOnCloud.cloudButton.checking')
              : $t('openOnCloud.cloudButton.check')
          }}
        </Button>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import DialogDescription from '@comfyorg/design-system/dialog/DialogDescription'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import { useTelemetry } from '@comfyorg/telemetry'
import type { RunOnCloudTelemetryEvent } from '@comfyorg/telemetry/types'
import { storeToRefs } from 'pinia'
import { computed, ref, toRaw, watch } from 'vue'

import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

import DeploySetupCard from '@/platform/openOnCloud/components/DeploySetupCard.vue'
import RunOnCloudCard from '@/platform/openOnCloud/components/RunOnCloudCard.vue'
import MissingModelsCard from '@/platform/openOnCloud/components/MissingModelsCard.vue'
import type { RunOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { runOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useLocalModelUploadStore } from '@/platform/openOnCloud/stores/localModelUploadStore'
import type { MissingModel } from '@/platform/openOnCloud/stores/localModelUploadStore'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'

const { uploadBatch, requestCheck } = defineProps<{
  uploadBatch?: { models: MissingModel[]; owner: string }
  requestCheck?: () => boolean
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
  signInToUpload: []
}>()

const checkRequested = ref(false)

function startCheck() {
  if (checkRequested.value) return
  checkRequested.value = requestCheck?.() ?? false
}

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
