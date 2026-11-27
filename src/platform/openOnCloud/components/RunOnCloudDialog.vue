<template>
  <MissingModelsCard
    v-if="state.kind === 'missingModels'"
    :models="state.models"
    @dismiss="emit('dismiss')"
  />
  <DeploySetupCard
    v-else-if="state.kind === 'deploySetup'"
    :body="$t('openOnCloud.deploySetupDialog.missingDependenciesBody')"
    :video-sources="DEPLOY_VIDEO_SOURCES"
    :poster-src="DEPLOY_VIDEO_POSTER_SRC"
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
  <RunOnCloudCard
    v-else
    :asks-to-sign-in="state.kind === 'ready' && state.asksToSignIn"
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
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import {
  saveAskBeforeCloudCheck,
  skipsCloudCheckQuestion
} from '@/platform/openOnCloud/cloudCheckConsent'
import DeploySetupCard from '@/platform/openOnCloud/components/DeploySetupCard.vue'
import RunOnCloudCard from '@/platform/openOnCloud/components/RunOnCloudCard.vue'
import MissingModelsCard from '@/platform/openOnCloud/components/MissingModelsCard.vue'
import { runOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'

const { requestCheck } = defineProps<{
  requestCheck?: (signal: AbortSignal) => boolean
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

const checkRequested = ref(false)
const checkConsent = new AbortController()
onBeforeUnmount(() => checkConsent.abort())

function startCheck(dontAskAgain = false) {
  if (checkRequested.value || !requestCheck?.(checkConsent.signal)) return
  checkRequested.value = true
  if (dontAskAgain) void saveAskBeforeCloudCheck(false)
}

onMounted(() => {
  if (skipsCloudCheckQuestion()) startCheck()
})

const { state: check } = storeToRefs(useCloudWorkflowCheckStore())
const { isLoggedIn } = useCurrentUser()
const state = computed(() =>
  runOnCloudModalState(
    requestCheck && !checkRequested.value ? { phase: 'idle' } : check.value,
    {
      signedIn: isLoggedIn.value
    }
  )
)
</script>
