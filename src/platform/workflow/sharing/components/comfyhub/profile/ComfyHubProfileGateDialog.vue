<template>
  <ComfyHubIntroPopover
    v-if="stepper.isCurrent('intro')"
    :on-create-profile="stepper.goToNext"
    :on-close="close"
  />
  <ComfyHubCreateProfileModal
    v-else-if="stepper.isCurrent('create')"
    :on-profile-created="handleProfileCreated"
    :on-close="close"
  />
  <ComfyHubProfileSuccessPopover
    v-else-if="stepper.isCurrent('success') && createdProfile"
    :profile="createdProfile"
    :on-upload="handleUpload"
    :on-close="close"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useStepper } from '@vueuse/core'

import type { ComfyHubProfile } from '@/schemas/apiSchema'

import ComfyHubCreateProfileModal from './ComfyHubCreateProfileModal.vue'
import ComfyHubIntroPopover from './ComfyHubIntroPopover.vue'
import ComfyHubProfileSuccessPopover from './ComfyHubProfileSuccessPopover.vue'

const { onComplete, onClose } = defineProps<{
  onComplete: () => void
  onClose: () => void
}>()

const stepper = useStepper(['intro', 'create', 'success'])
const createdProfile = ref<ComfyHubProfile | null>(null)

function handleProfileCreated(profile: ComfyHubProfile) {
  createdProfile.value = profile
  stepper.goToNext()
}

function handleUpload() {
  onComplete()
}

function close() {
  onClose()
}
</script>
