<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div
    class="flex flex-col justify-center items-center h-screen font-mono text-black gap-4"
  >
    <h1 class="text-2xl">Processing Invite Code...</h1>
    <button
      class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
      @click="onClaim"
    >
      Claim Invite
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { claimInvite } from '@/api/auth'

const route = useRoute()
const router = useRouter()

const onClaim = () => {
  const inviteCode = route.query.inviteCode as string
  console.log('>>> route.query.inviteCode', route.query.inviteCode)
  const success = claimInvite(inviteCode)

  if (!success) {
    // Invalid invite code
    void router.push({ name: 'sorry-contact-support' })
    return
  }

  // Mark as claimed
  localStorage.setItem(`claimed_${inviteCode}`, 'true')

  // Check survey status
  const surveyCompleted = localStorage.getItem('surveyCompleted') === 'true'

  if (!surveyCompleted) {
    // Need to complete survey
    void router.push({
      name: 'cloud-survey',
      query: { inviteCode }
    })
  } else {
    // Survey already done, go to service
    void router.push({ name: 'graph' })
  }
}

onMounted(async () => {
  const inviteCode = route.query.inviteCode as string

  if (!inviteCode) {
    void router.push({ name: 'sorry-contact-support' })
    return
  }

  // Check if already claimed
  const alreadyClaimed =
    localStorage.getItem(`claimed_${inviteCode}`) === 'true'

  if (alreadyClaimed) {
    // Already claimed this code
    void router.push({ name: 'sorry-contact-support' })
    return
  }
})
</script>
