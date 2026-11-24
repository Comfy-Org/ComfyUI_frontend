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
    :unchecked-inputs="state.uncheckedInputs"
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
  <DeploymentDialogFrame v-else-if="requestCheck" @dismiss="emit('dismiss')">
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
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'

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
  requestCheck?: () => boolean
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

const checkRequested = ref(false)

function startCheck() {
  if (checkRequested.value) return
  checkRequested.value = requestCheck?.() ?? false
}

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
