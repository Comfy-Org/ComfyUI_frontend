<template>
  <UploadModelsCard
    v-if="state.kind === 'uploadModels' || state.kind === 'uploading'"
    :title-id
    :models="state.models"
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
  <DeploySetupCard
    v-else-if="state.kind === 'deploySetup'"
    :title-id
    :video-sources="DEPLOY_VIDEO_SOURCES"
    :poster-src="DEPLOY_VIDEO_POSTER_SRC"
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
  <RunOnCloudCard
    v-else
    :title-id
    :state
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import DeploySetupCard from '@/platform/openOnCloud/components/DeploySetupCard.vue'
import RunOnCloudCard from '@/platform/openOnCloud/components/RunOnCloudCard.vue'
import UploadModelsCard from '@/platform/openOnCloud/components/UploadModelsCard.vue'
import { runOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useModelUploadStore } from '@/platform/openOnCloud/stores/modelUploadStore'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'

const { titleId } = defineProps<{
  titleId?: string
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

const { state: check } = storeToRefs(useCloudWorkflowCheckStore())
const { state: upload } = storeToRefs(useModelUploadStore())
const state = computed(() => runOnCloudModalState(check.value, upload.value))
</script>
