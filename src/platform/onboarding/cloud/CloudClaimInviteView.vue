<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div
    class="flex flex-col justify-center items-center h-screen font-mono text-black gap-4"
  >
    <!-- Loading skeleton -->
    <CloudClaimInviteViewSkeleton v-if="isLoading" />

    <!-- Content once loaded -->
    <template v-else>
      <h1 class="text-2xl">Processing Invite Code...</h1>
      <button
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
        @click="onClaim"
      >
        Claim Invite
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import CloudClaimInviteViewSkeleton from './skeletons/CloudClaimInviteViewSkeleton.vue'

const router = useRouter()
const isLoading = ref(true)

onMounted(async () => {
  // Simulate initial loading state
  await new Promise((resolve) => setTimeout(resolve, 500))
  isLoading.value = false
})

const onClaim = () => {
  void router.push({ name: 'cloud-user-check' })
}
</script>
