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
const { activeModels, isUploading, owner, retryBatches, upload } = storeToRefs(
  useLocalModelUploadStore()
)
const { isLoggedIn } = useCurrentUser()
const { flags } = useFeatureFlags()
const uploadModels = computed(() => {
  if (!flags.openOnCloudModelUploadEnabled) return undefined
  const models = uploadBatch && toRaw(uploadBatch.models)
  if (
    models &&
    uploadBatch?.owner === owner.value &&
    (activeModels.value === models || retryBatches.value.includes(models))
  )
    return models
  return isUploading.value ? activeModels.value : undefined
})
const state = computed(() => {
  if (uploadModels.value)
    return { kind: 'missingModels' as const, models: uploadModels.value }
  return runOnCloudModalState(check.value, { signedIn: isLoggedIn.value })
})
watch(upload, (current) => {
  if (
    uploadBatch &&
    !uploadModels.value &&
    (current.phase === 'done' ||
      (current.phase === 'failed' && current.reason === 'cancelled'))
  )
    emit('dismiss')
})
</script>
