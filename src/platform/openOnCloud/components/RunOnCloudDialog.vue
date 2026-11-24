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
    :unchecked-inputs="state.uncheckedInputs"
    :workspace-id="state.workspaceId"
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, toRaw, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

import DeploySetupCard from '@/platform/openOnCloud/components/DeploySetupCard.vue'
import RunOnCloudCard from '@/platform/openOnCloud/components/RunOnCloudCard.vue'
import MissingModelsCard from '@/platform/openOnCloud/components/MissingModelsCard.vue'
import { runOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useLocalModelUploadStore } from '@/platform/openOnCloud/stores/localModelUploadStore'
import type { MissingModel } from '@/platform/openOnCloud/stores/localModelUploadStore'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'

const { uploadBatch } = defineProps<{
  uploadBatch?: { models: MissingModel[]; owner: string }
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
  signInToUpload: []
}>()

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
  if (uploadBatch) return { kind: 'checking' as const }
  return runOnCloudModalState(check.value, { signedIn: isLoggedIn.value })
})
watch([owner, uploadModels], ([currentOwner, models]) => {
  if (uploadBatch && (uploadBatch.owner !== currentOwner || !models))
    emit('dismiss')
})
</script>
