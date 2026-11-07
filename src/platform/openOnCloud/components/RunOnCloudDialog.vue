<template>
  <RunOnCloudCard
    v-if="state.kind === 'ready'"
    :asks-to-sign-in="state.asksToSignIn"
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import RunOnCloudCard from '@/platform/openOnCloud/components/RunOnCloudCard.vue'
import { runOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'

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
</script>
