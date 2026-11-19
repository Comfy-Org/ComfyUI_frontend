<template>
  <MissingModelsCard
    v-if="state.kind === 'missingModels'"
    :models="state.models"
    :signed-in="isLoggedIn"
    @dismiss="emit('dismiss')"
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
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import DeploySetupCard from '@/platform/openOnCloud/components/DeploySetupCard.vue'
import RunOnCloudCard from '@/platform/openOnCloud/components/RunOnCloudCard.vue'
import MissingModelsCard from '@/platform/openOnCloud/components/MissingModelsCard.vue'
import { runOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useLocalModelUploadStore } from '@/platform/openOnCloud/stores/localModelUploadStore'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

const { state: check } = storeToRefs(useCloudWorkflowCheckStore())
const { activeModels } = storeToRefs(useLocalModelUploadStore())
const { isLoggedIn } = useCurrentUser()
const state = computed(() => {
  if (activeModels.value)
    return { kind: 'missingModels' as const, models: activeModels.value }
  return runOnCloudModalState(check.value, { signedIn: isLoggedIn.value })
})
</script>
