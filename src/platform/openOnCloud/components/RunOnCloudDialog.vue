<template>
  <MissingModelsCard
    v-if="state.kind === 'missingModels'"
    :models="state.models"
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
import { useTelemetry } from '@comfyorg/telemetry'
import type { RunOnCloudTelemetryEvent } from '@comfyorg/telemetry/types'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import DeploySetupCard from '@/platform/openOnCloud/components/DeploySetupCard.vue'
import RunOnCloudCard from '@/platform/openOnCloud/components/RunOnCloudCard.vue'
import MissingModelsCard from '@/platform/openOnCloud/components/MissingModelsCard.vue'
import type { RunOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { runOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

const { state: check } = storeToRefs(useCloudWorkflowCheckStore())
const { isLoggedIn } = useCurrentUser()
const state = computed(() =>
  runOnCloudModalState(check.value, {
    signedIn: isLoggedIn.value
  })
)

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
          asks_to_sign_in: shown.asksToSignIn
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
