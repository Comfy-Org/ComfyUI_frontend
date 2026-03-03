<template>
  <ComfyHubIntroPopover
    v-if="stepper.isCurrent('intro')"
    :on-create-profile="stepper.goToNext"
    :on-close
    :show-close-button
  />
  <ComfyHubCreateProfileModal
    v-else-if="stepper.isCurrent('create')"
    :on-profile-created
    :on-close
    :show-close-button
  />
  <ComfyHubProfileSuccessPopover
    v-else-if="stepper.isCurrent('success') && createdProfile"
    :profile="createdProfile"
    :on-upload="onComplete"
    :on-close
    :show-close-button
  />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useStepper } from '@vueuse/core'

import type { ComfyHubProfile } from '@/schemas/apiSchema'

import ComfyHubCreateProfileModal from './ComfyHubCreateProfileModal.vue'
import ComfyHubIntroPopover from './ComfyHubIntroPopover.vue'
import ComfyHubProfileSuccessPopover from './ComfyHubProfileSuccessPopover.vue'

type ProfileGateStep = 'intro' | 'create' | 'success'

const {
  onComplete,
  onClose,
  initialStep = 'intro',
  showCloseButton = true
} = defineProps<{
  onComplete: () => void
  onClose: () => void
  initialStep?: Extract<ProfileGateStep, 'intro' | 'create'>
  showCloseButton?: boolean
}>()

const stepper = useStepper(['intro', 'create', 'success'])
const createdProfile = ref<ComfyHubProfile>()

onMounted(() => {
  stepper.goTo(initialStep)
})

function onProfileCreated(profile: ComfyHubProfile) {
  createdProfile.value = profile
  stepper.goToNext()
}
</script>
