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
import { useRouter } from 'vue-router'

const router = useRouter()

const onClaim = () => {
  void router.push({ name: 'cloud-user-check' })
}
</script>
