<template>
  <CloudClaimInviteViewSkeleton />
</template>

<script setup lang="ts">
import { nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

import CloudClaimInviteViewSkeleton from './skeletons/CloudClaimInviteViewSkeleton.vue'

const router = useRouter()
const route = useRoute()

onMounted(async () => {
  await nextTick()

  const inviteCode = route.query.inviteCode as string

  try {
    // Basic guard: missing invite code -> send to support
    if (!inviteCode || typeof inviteCode !== 'string') {
      await router.push({ name: 'cloud-sorry-contact-support' })
      return
    }

    const { isEmailVerified } = useFirebaseAuthStore()

    if (!isEmailVerified) {
      await router.push({ name: 'cloud-verify-email', query: { inviteCode } })
      return
    }
    await router.push({ name: 'cloud-claim-invite', query: { inviteCode } })
  } catch (e) {
    window.open('https://support.comfy.org', '_blank', 'noopener')
    return
  }
})
</script>
